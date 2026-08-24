#!/usr/bin/env bash
# Show every worktree, its slot, and any leaked Supabase branch databases.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/worktree-common.sh
source "$SCRIPT_DIR/lib/worktree-common.sh"

primary=$(wt_primary_path)

# Prime the merged-PR cache here, in the parent shell: the row loop below runs
# in a pipeline subshell, and a cache filled in there would be thrown away and
# refetched for every row.
wt_load_merged_heads

printf '%-40s %-8s %-6s %-6s %-24s %s\n' "BRANCH" "DB" "EXPO" "API" "SIMULATOR" "PATH"

git worktree list --porcelain | awk '
  function emit() { if (path != "") print path "\t" branch }
  $1 == "worktree" { emit(); path = substr($0, 10); branch = "(detached)" }
  $1 == "branch"   { branch = $2; sub("refs/heads/", "", branch) }
  END { emit() }
' | while IFS=$'\t' read -r path branch; do
  if [ "$path" = "$primary" ]; then
    expo=$(wt_read_value "$path/apps/mobile/.env" "EXPO_PORT" 2>/dev/null || echo "-")
    api=$(wt_read_value "$path/apps/api/.env" "PORT" 2>/dev/null || echo "-")
    sim=$(wt_read_value "$path/apps/mobile/.env" "IOS_SIMULATOR" 2>/dev/null || echo "-")
    printf '%-40s %-8s %-6s %-6s %-24s %s\n' "$branch" "shared*" "$expo" "$api" "$sim*" "$path"
    continue
  fi
  meta="$path/.env.worktree"
  mode=$(wt_read_value "$meta" "WT_DB_MODE" 2>/dev/null || echo "-")
  expo=$(wt_read_value "$meta" "WT_EXPO_PORT" 2>/dev/null || echo "-")
  api=$(wt_read_value "$meta" "WT_API_PORT" 2>/dev/null || echo "-")
  sim=$(wt_read_value "$meta" "WT_SIM_NAME" 2>/dev/null || echo "-")
  udid=$(wt_read_value "$meta" "WT_SIM_UDID" 2>/dev/null || echo "")
  sim_mode=$(wt_read_value "$meta" "WT_SIM_MODE" 2>/dev/null || echo "device")
  # Set up with --no-sim: say so rather than printing a simulator name that
  # exists only in the ledger.
  [ "${sim_mode:-device}" = "none" ] && sim="(none)" && udid=""

  [ "$expo" != "-" ] && wt_port_in_use "$expo" && expo="$expo*"
  [ "$api" != "-" ] && wt_port_in_use "$api" && api="$api*"
  booted=""
  [ -n "$udid" ] && wt_sim_is_booted "$udid" && booted=" [up]"

  # A worktree whose PR has merged is finished work still holding a slot — and
  # in branch mode, still costing money every hour it sits here. Deliberately a
  # merged-PR question and not an ancestry one: ancestry is blind to squash
  # merges, and it fires on a brand-new worktree sitting at master's HEAD.
  merged=""
  merged_pr=0
  wt_branch_has_merged_pr "$branch" || merged_pr=$?
  if [ "$merged_pr" -eq 0 ]; then
    if [ "$mode" = "branch" ]; then
      merged="  <-- MERGED; its branch DB is billing right now. Reclaim: pnpm wt:rm $branch"
    else
      merged="  <-- MERGED into master; reclaim with: pnpm wt:rm $branch"
    fi
  fi

  printf '%-40s %-8s %-6s %-6s %-24s %s%s\n' "$branch" "$mode" "$expo" "$api" "${sim}${booted}" "$path" "$merged"
done

echo
echo "* the main checkout is intentionally unmanaged; a starred port is listening right now."

# A listing that could not ask must say so. Silence here is indistinguishable
# from "nothing has merged", which is the reading that lets a finished worktree
# keep billing unnoticed.
if [ "$WT_MERGED_HEADS_STATE" = "unknown" ]; then
  echo
  echo "WARNING: could not ask GitHub which PRs have merged, so finished"
  echo "worktrees are NOT flagged above. Check by hand:"
  echo "  gh pr list --state merged --json headRefName"
fi

# --- leaked branch databases -------------------------------------------------
# A branch DB with no worktree behind it is billed and forgotten. This is the
# safety net for a teardown that died halfway, not a comment on your discipline.

# wt_branch_table is strict: it fails loudly rather than reading an error
# payload as an empty list. A safety net that cannot check must say so —
# silence here looks identical to "no leaks", during the exact outage or auth
# failure most likely to have also broken a teardown.
table=""
if table=$(wt_branch_table); then
  known=$(mktemp)
  while IFS= read -r p; do
    wt_read_value "$p/.env.worktree" "WT_BRANCH_NAME" 2>/dev/null || true
  done < <(wt_linked_paths) | grep -v '^$' > "$known" || true

  orphans=$(printf '%s\n' "$table" | awk -F'\t' -v knownfile="$known" '
    BEGIN { while ((getline line < knownfile) > 0) if (line != "") seen[line] = 1 }
    $1 != "" && $3 != "default" && !($1 in seen) { printf "  %s  (%s)\n", $1, $2 }
  ')
  rm -f "$known"

  if [ -n "$orphans" ]; then
    echo
    echo "ORPHANED BRANCH DATABASES (billed hourly, no worktree using them):"
    echo "$orphans"
    echo "  Delete with: supabase branches delete <name> --project-ref $WT_PROJECT_REF"
  fi
else
  echo
  echo "WARNING: could not fetch the Supabase branch list, so orphaned branch"
  echo "databases (billed hourly) could NOT be checked. Verify by hand:"
  echo "  supabase branches list --project-ref $WT_PROJECT_REF"
fi
