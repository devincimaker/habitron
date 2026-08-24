#!/usr/bin/env bash
# Prepare (or repair) a worktree. Idempotent — safe to re-run on a half-built one.
#
#   pnpm wt:setup                 # this worktree, keeping its current modes
#   pnpm wt:setup --db            # give it (or move it to) its own branch DB
#   pnpm wt:setup --no-db         # move it back to the shared hosted project
#   pnpm wt:setup --no-sim        # skip the simulator: nothing on screen changes
#   pnpm wt:setup --sim           # build one after all, once the diff says so
#   pnpm wt:setup <path> --db
#
# Conductor invokes this with no arguments from inside a freshly created
# workspace, which is why every mode has a default and re-running is safe.
#
# A worktree owns an Expo port, an API port and a simulator it created for
# itself. Its database is the shared hosted project by default, or its own
# hosted Supabase branch under --db. Ports are coordinated across repos through
# ~/.conductor/state/resources.json; everything else is recorded in this
# worktree's .env.worktree ledger.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/worktree-common.sh
source "$SCRIPT_DIR/lib/worktree-common.sh"
# shellcheck source=lib/resource-registry.sh
source "$SCRIPT_DIR/lib/resource-registry.sh"

# --- port pools --------------------------------------------------------------
# Wide enough that "no ports left" means something is leaking, not that you
# opened a sixth worktree.
WT_EXPO_PORT_MIN=8082
WT_EXPO_PORT_MAX=8099
WT_API_PORT_MIN=3002
WT_API_PORT_MAX=3019

# --- arguments ---------------------------------------------------------------

target=""
db_mode=""
sim_mode=""
for arg in "$@"; do
  case "$arg" in
    --db)     db_mode="branch" ;;
    --no-db)  db_mode="shared" ;;
    --sim)    sim_mode="device" ;;
    --no-sim) sim_mode="none" ;;
    -*)       wt_die "Unknown flag: $arg" ;;
    *)        target="$arg" ;;
  esac
done
target=${target:-$(pwd -P)}

# --- guards ------------------------------------------------------------------

[ -d "$target" ] || wt_die "No such directory: $target"
target=$(cd "$target" && pwd -P)

primary=$(wt_primary_path)
[ "$target" != "$primary" ] || wt_die \
  "The main checkout stays unmanaged — wt:setup is only for linked worktrees."

target_common=$(git -C "$target" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
[ "$target_common" = "$(wt_git_common_dir)" ] || wt_die "$target is not a worktree of this repository"

branch=$(git -C "$target" branch --show-current)
[ -n "$branch" ] || wt_die "Worktree must be on a branch, not a detached HEAD"

registry_require_jq || exit 1
wt_lock

metadata="$target/.env.worktree"
slug=$(wt_slug "$branch")

# Flags win; otherwise keep whatever this worktree already is; default shared.
if [ -z "$db_mode" ]; then
  db_mode=$(wt_read_value "$metadata" "WT_DB_MODE" 2>/dev/null || true)
  db_mode=${db_mode:-shared}
fi

# Same sticky rule for the simulator. Default is to build one, so a worktree
# that never says otherwise behaves as it always has. --no-sim is what makes
# "nothing on screen changes" actually save time.
if [ -z "$sim_mode" ]; then
  sim_mode=$(wt_read_value "$metadata" "WT_SIM_MODE" 2>/dev/null || true)
  sim_mode=${sim_mode:-device}
fi

# --- slot: ports + simulator name (sticky across re-runs) --------------------

registry_init
registry_reap_stale

# Ports reserved elsewhere: the cross-repo registry, sibling worktree ledgers,
# the main checkout's own .env, and anything actually listening right now.
port_taken() {
  local wanted=$1 kind=$2 path assigned
  while IFS= read -r path; do
    [ "$path" = "$target" ] && continue
    assigned=$(wt_read_value "$path/.env.worktree" "$kind" 2>/dev/null || true)
    [ "$assigned" = "$wanted" ] && return 0
  done < <(wt_linked_paths)
  wt_port_in_use "$wanted" && return 0
  return 1
}

reserved_has() {
  local wanted=$1 val
  while IFS= read -r val; do
    [ "$val" = "$wanted" ] && return 0
  done
  return 1
}

alloc_port() {
  # Split from the `local` below on purpose: bash 3.2 (which is what macOS
  # ships) evaluates every right-hand side before binding any of the names, so
  # `port=$min` on the same line reads an unset global and trips `set -u`.
  local kind=$1 min=$2 max=$3 reserved=$4 main_value=$5
  local port=$min
  while [ "$port" -le "$max" ]; do
    if ! printf '%s\n' "$reserved" | reserved_has "$port" \
       && [ "$port" != "$main_value" ] \
       && ! port_taken "$port" "$kind"; then
      printf '%s\n' "$port"
      return 0
    fi
    port=$((port + 1))
  done
  wt_die "No free port for $kind in ${min}-${max}"
}

# Drop this worktree's own prior claim so a re-run does not collide with itself.
registry_release "$target"

reserved_expo=$(registry_list_reserved_expo_ports || true)
reserved_api=$(registry_list_reserved_api_ports || true)
main_expo=$(wt_read_value "$primary/apps/mobile/.env" "EXPO_PORT" 2>/dev/null || true)
main_api=$(wt_read_value "$primary/apps/api/.env" "PORT" 2>/dev/null || true)

expo_port=$(wt_read_value "$metadata" "WT_EXPO_PORT" 2>/dev/null || true)
[ -n "$expo_port" ] || expo_port=$(alloc_port "WT_EXPO_PORT" "$WT_EXPO_PORT_MIN" "$WT_EXPO_PORT_MAX" "$reserved_expo" "${main_expo:-}")

api_port=$(wt_read_value "$metadata" "WT_API_PORT" 2>/dev/null || true)
[ -n "$api_port" ] || api_port=$(alloc_port "WT_API_PORT" "$WT_API_PORT_MIN" "$WT_API_PORT_MAX" "$reserved_api" "${main_api:-}")

sim_name=$(wt_read_value "$metadata" "WT_SIM_NAME" 2>/dev/null || true)
[ -n "$sim_name" ] || sim_name="thrive-$slug"

wt_step "Worktree $branch"
wt_info "path       $target"
wt_info "db mode    $db_mode"
wt_info "expo port  $expo_port"
wt_info "api port   $api_port"
wt_info "simulator  $sim_name"

previous_branch_name=$(wt_read_value "$metadata" "WT_BRANCH_NAME" 2>/dev/null || true)

# Claim the slot NOW, not at the end. Allocation scans sibling ledgers, so a
# slot that is not written until setup finishes can be handed out twice — and
# setup can take minutes or die halfway.
wt_upsert_env "$metadata" "WT_SLUG" "$slug"
wt_upsert_env "$metadata" "WT_BRANCH" "$branch"
wt_upsert_env "$metadata" "WT_EXPO_PORT" "$expo_port"
wt_upsert_env "$metadata" "WT_API_PORT" "$api_port"
wt_upsert_env "$metadata" "WT_SIM_NAME" "$sim_name"

# The mode is claimed here too, but only when it is safe to claim early.
#
#   branch: MUST be written now. Provisioning and migrations come later and can
#   fail, and the recovery path is "re-run wt:setup". With no mode on disk that
#   re-run reads nothing, defaults to shared, and deletes the branch it just
#   spent minutes creating — silently putting the worktree on the shared
#   database, which is the one outcome --db exists to prevent.
#
#   shared: only when there is no branch to lose. Writing shared while a branch
#   still exists, then dying before the delete, would leave it billing with the
#   ledger claiming otherwise.
if [ "$db_mode" = "branch" ] || [ -z "$previous_branch_name" ]; then
  wt_upsert_env "$metadata" "WT_DB_MODE" "$db_mode"
fi

# Built with plain ifs, not `$(cond && echo …)`: under `set -e` an assignment
# whose last command substitution exits non-zero takes the whole script down,
# and a false condition here is the normal case.
retry_hint="pnpm wt:setup $target"
[ "$db_mode" = "branch" ] && retry_hint="$retry_hint --db"
[ "$sim_mode" = "none" ] && retry_hint="$retry_hint --no-sim"

# One EXIT trap, doing both jobs. Registering a second one would silently
# replace wt_lock's, leaking the lock directory on every run.
on_exit() {
  local rc=$?
  wt_unlock
  [ "$rc" -eq 0 ] && return 0
  echo "" >&2
  echo "Setup did not finish (exit $rc). The worktree and its slot are intact —" >&2
  echo "re-run it, do not delete and start over:" >&2
  echo "  $retry_hint" >&2
}
trap on_exit EXIT

# --- env files ---------------------------------------------------------------
# Gitignored, so git does not carry them into a new worktree. Seed from the main
# checkout, then override the parts that must differ. Copied only when missing:
# a re-run must not clobber branch-database credentials written below.

wt_step "Environment files"
for rel in "${WT_ENV_FILES[@]}"; do
  if [ ! -f "$target/$rel" ]; then
    [ -f "$primary/$rel" ] || wt_die "Source file not found: $primary/$rel"
    mkdir -p "$(dirname "$target/$rel")"
    cp "$primary/$rel" "$target/$rel"
    wt_info "copied $rel from the main checkout"
  fi
done

# --- dependencies ------------------------------------------------------------

if [ "${WORKTREE_SKIP_INSTALL:-0}" = "1" ]; then
  wt_step "Dependencies: skipped (WORKTREE_SKIP_INSTALL=1)"
elif [ ! -d "$target/node_modules" ]; then
  wt_step "Installing dependencies (pnpm hardlinks from the shared store)"
  (cd "$target" && pnpm install --prefer-offline)
fi

# --- database ----------------------------------------------------------------

supabase_url=""
anon_key=""
service_key=""
db_url=""
branch_name=$(wt_read_value "$metadata" "WT_BRANCH_NAME" 2>/dev/null || true)
branch_ref=$(wt_read_value "$metadata" "WT_BRANCH_REF" 2>/dev/null || true)

if [ "$db_mode" = "shared" ]; then
  # Downgrading from a branch: delete it here, or it bills forever — teardown
  # skips deletion once the mode is shared, and wt:list treats a named branch in
  # the ledger as claimed, so it would never show up as orphaned either.
  if [ -n "$previous_branch_name" ]; then
    wt_step "Releasing the previous branch database '$previous_branch_name'"
    if supabase branches delete "$previous_branch_name" --project-ref "$WT_PROJECT_REF" --yes 2>/dev/null; then
      # Clear the name only now: while it is set, teardown still knows to delete.
      wt_upsert_env "$metadata" "WT_BRANCH_NAME" ""
      wt_upsert_env "$metadata" "WT_BRANCH_REF" ""
      # And record shared in the same breath. This is the exact moment it became
      # safe: the branch is confirmed gone, so nothing is left for a stale
      # mode=branch to protect. Waiting until the end of setup would mean any
      # later failure leaves mode=branch on disk, and the bare wt:setup retry
      # creates a brand new billable branch rather than finishing the downgrade.
      wt_upsert_env "$metadata" "WT_DB_MODE" "shared"
      branch_name=""
      branch_ref=""
      wt_info "deleted (billing stops)"
    else
      wt_die "Could not delete branch '$previous_branch_name'. Refusing to switch to
shared mode while it may still exist and bill. Delete it and re-run:
  supabase branches delete $previous_branch_name --project-ref $WT_PROJECT_REF"
    fi
  fi

  wt_step "Database: the shared hosted project (shared)"
  supabase_url=$(wt_read_value "$primary/apps/mobile/.env" "EXPO_PUBLIC_SUPABASE_URL" 2>/dev/null || true)
  anon_key=$(wt_read_value "$primary/apps/mobile/.env" "EXPO_PUBLIC_SUPABASE_ANON_KEY" 2>/dev/null || true)
  service_key=$(wt_read_value "$primary/apps/api/.env" "SUPABASE_SERVICE_ROLE_KEY" 2>/dev/null || true)
  [ -n "$supabase_url" ] && [ -n "$anon_key" ] && [ -n "$service_key" ] \
    || wt_die "Could not read the shared project's URL and keys from the main checkout's .env files"
  wt_info "$supabase_url"
  wt_info "This is the same database the app and the API use. Schema changes here are live —"
  wt_info "run 'pnpm wt:setup --db' first if this branch needs its own."
else
  wt_step "Database: dedicated Supabase branch"
  branch_name=${branch_name:-$slug}

  branch_created=""
  if wt_branch_exists "$branch_name"; then
    wt_info "branch '$branch_name' already exists — reusing"
  else
    wt_info "creating branch '$branch_name' (the slow step — minutes)"
    supabase branches create "$branch_name" --project-ref "$WT_PROJECT_REF" --yes \
      || wt_die "Could not create branch '$branch_name'"
    # Record it immediately: if provisioning fails below, the ledger still names
    # the branch so teardown can delete it rather than leaving it billing.
    wt_upsert_env "$metadata" "WT_BRANCH_NAME" "$branch_name"
    branch_created=1
  fi

  wt_info "waiting for it to come up..."
  status=""
  flagged=""
  for _ in $(seq 1 120); do
    # `|| true`: a blip in the listing API should retry the poll, not abort a
    # branch that is provisioning fine.
    status=$(wt_branch_status "$branch_name" || true)
    case "$status" in
      FUNCTIONS_DEPLOYED|MIGRATIONS_PASSED|ACTIVE_HEALTHY|RUNNING) break ;;
      # Reachable, but Supabase is unhappy about something. NOT fatal on its
      # own: creating a branch of this project reliably ends in
      # MIGRATIONS_FAILED while leaving a complete, working schema behind, and
      # the status never clears. Treating it as fatal locks the branch out of
      # every later wt:setup --db for good. The migration check below queries
      # the database itself, which cannot be wrong about this.
      MIGRATIONS_FAILED|FUNCTIONS_FAILED) flagged=$status; break ;;
    esac
    sleep 5
  done
  [ -n "$status" ] || wt_die "Branch '$branch_name' never reported a status"
  wt_info "status $status"
  [ -n "$flagged" ] && wt_info "(not trusted on its own — the migration check below is the verdict)"

  branch_json=$(supabase branches get "$branch_name" --project-ref "$WT_PROJECT_REF" -o json 2>/dev/null || true)
  # Never echo the payload itself — it carries the service-role key and Postgres
  # URLs with passwords in them. Key names are enough to diagnose a shape change.
  branch_keys=$(wt_branch_keys "$branch_json")
  supabase_url=$(wt_branch_field "$branch_json" "SUPABASE_URL") || wt_die \
    "Could not read SUPABASE_URL from the branch payload. Keys present: $branch_keys"
  anon_key=$(wt_branch_field "$branch_json" "SUPABASE_ANON_KEY") || wt_die \
    "Could not read SUPABASE_ANON_KEY from the branch payload. Keys present: $branch_keys"
  service_key=$(wt_branch_field "$branch_json" "SUPABASE_SERVICE_ROLE_KEY") || wt_die \
    "Could not read SUPABASE_SERVICE_ROLE_KEY from the branch payload. Keys present: $branch_keys"
  # Connection choice matters twice over. POSTGRES_URL_NON_POOLING points at
  # db.<ref>.supabase.co, which resolves IPv6-only and is unreachable from an
  # IPv4 network. POSTGRES_URL reaches the pooler over IPv4 but on 6543 —
  # transaction mode, where migrations lose advisory locks. Session mode is the
  # same host on 5432.
  db_url=$(wt_branch_field "$branch_json" "POSTGRES_URL" | sed 's/:6543\//:5432\//' || true)
  [ -n "$db_url" ] || db_url=$(wt_branch_field "$branch_json" "POSTGRES_URL_NON_POOLING" || true)

  branch_ref=$(printf '%s' "$supabase_url" | sed -E 's#https://([^.]+)\..*#\1#')
  wt_upsert_env "$metadata" "WT_BRANCH_REF" "$branch_ref"
  wt_info "branch ref $branch_ref"

  # `db push` has no --project-ref; it takes a linked project or --db-url.
  [ -n "$db_url" ] || wt_die "No Postgres URL in the branch payload — cannot reach the branch."

  # A freshly created branch is still applying this repo's migrations on
  # Supabase's side, whatever its status field says. Wait for that to settle
  # before deciding whether anything is left for us to push — pushing into the
  # middle of it makes both writers collide on schema_migrations. See
  # wt_unapplied_count for the full story.
  if [ -n "$branch_created" ]; then
    wt_step "Waiting for Supabase to finish applying migrations"
    for _ in $(seq 1 36); do
      pending=$(wt_unapplied_count "$target" "$db_url") || { sleep 5; continue; }
      [ "$pending" -eq 0 ] && break
      sleep 5
    done
  fi

  pending=$(wt_unapplied_count "$target" "$db_url") \
    || wt_die "Could not read this branch's migration state. Check it by hand:
  supabase migration list --db-url \"\$SUPABASE_DB_URL\""

  if [ "$pending" -gt 0 ]; then
    wt_step "Applying $pending migration(s) this branch is missing"
    (cd "$target" && supabase db push --db-url "$db_url" --yes) || wt_die "Migration push failed"
    pending=$(wt_unapplied_count "$target" "$db_url") || pending=-1
    [ "$pending" = "0" ] || wt_die "Migrations still unapplied after the push (count: $pending)"
  else
    wt_step "Migrations"
    wt_info "every migration in this checkout is already applied"
  fi

  if [ -n "$flagged" ]; then
    wt_info "Supabase still reports $flagged for this branch. Its schema is complete"
    wt_info "(checked above), so that status is noise here, not a problem to fix."
  fi
fi

# --- write env ---------------------------------------------------------------

wt_upsert_env "$target/apps/api/.env" "PORT" "$api_port"
wt_upsert_env "$target/apps/api/.env" "SUPABASE_URL" "$supabase_url"
wt_upsert_env "$target/apps/api/.env" "SUPABASE_SERVICE_ROLE_KEY" "$service_key"
# Direct Postgres URL for the same database, so migration tooling in this
# worktree never has to guess. Carries a password in branch mode — .env is
# gitignored and already holds the service-role key.
wt_upsert_env "$target/apps/api/.env" "SUPABASE_DB_URL" "${db_url:-}"

wt_upsert_env "$target/apps/mobile/.env" "EXPO_PUBLIC_SUPABASE_URL" "$supabase_url"
wt_upsert_env "$target/apps/mobile/.env" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "$anon_key"
wt_upsert_env "$target/apps/mobile/.env" "EXPO_PUBLIC_API_URL" "http://localhost:$api_port"
wt_upsert_env "$target/apps/mobile/.env" "EXPO_PORT" "$expo_port"
wt_upsert_env "$target/apps/mobile/.env" "IOS_SIMULATOR" "$sim_name"

# --- simulator ---------------------------------------------------------------

sim_udid=""
if [ "$sim_mode" = "none" ]; then
  wt_step "Simulator: skipped"
  wt_info "no simulator for this worktree (--no-sim)"
  wt_info "changed your mind? pnpm wt:setup --sim"
else
  wt_step "Simulator"
  sim_udid=$(wt_sim_udid_for_name "$sim_name")
  if [ -z "$sim_udid" ]; then
    sim_udid=$(xcrun simctl create "$sim_name" "$WT_SIM_DEVICE_TYPE" "$WT_SIM_RUNTIME")
    wt_info "created $sim_name ($sim_udid)"
  else
    wt_info "reusing $sim_name ($sim_udid)"
  fi
  wt_upsert_env "$target/apps/mobile/.env" "IOS_SIMULATOR_UDID" "$sim_udid"

  app=$(wt_devclient_app)
  if [ -z "$app" ]; then
    wt_info "No built HabitsCoach.app found in DerivedData."
    wt_info "pnpm dev will build one on first run (minutes). To make it seconds, build once"
    wt_info "from the main checkout and re-run wt:setup:"
    wt_info "  (cd $primary/apps/mobile && npx expo run:ios --device 'iPhone 16e' --no-bundler)"
  else
    xcrun simctl bootstatus "$sim_udid" -b >/dev/null 2>&1 || true
    xcrun simctl install "$sim_udid" "$app"
    wt_info "installed $(basename "$app") ($(du -sh "$app" | awk '{print $1}'))"
    wt_preapprove_schemes "$sim_udid"
    wt_info "URL schemes pre-approved (deep links work without a SpringBoard prompt)"
  fi
fi

# --- ledger ------------------------------------------------------------------

wt_upsert_env "$metadata" "WT_SLUG" "$slug"
wt_upsert_env "$metadata" "WT_BRANCH" "$branch"
wt_upsert_env "$metadata" "WT_DB_MODE" "$db_mode"
wt_upsert_env "$metadata" "WT_EXPO_PORT" "$expo_port"
wt_upsert_env "$metadata" "WT_API_PORT" "$api_port"
wt_upsert_env "$metadata" "WT_SIM_MODE" "$sim_mode"
wt_upsert_env "$metadata" "WT_SIM_NAME" "$sim_name"
wt_upsert_env "$metadata" "WT_SIM_UDID" "$sim_udid"
wt_upsert_env "$metadata" "WT_BRANCH_NAME" "${branch_name:-}"
wt_upsert_env "$metadata" "WT_BRANCH_REF" "${branch_ref:-}"

registry_claim \
  "$target" \
  "$(basename "$primary")" \
  "$sim_name" \
  "$sim_udid" \
  "$expo_port" \
  "$api_port"

wt_step "Ready"
if [ "$sim_mode" = "none" ]; then
  wt_info "cd $target"
  wt_info "No simulator: the tests are the proof here. Needs one after all? pnpm wt:setup --sim"
else
  wt_info "cd $target && pnpm dev"
fi
