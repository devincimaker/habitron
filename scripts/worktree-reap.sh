#!/usr/bin/env bash
# Reclaim the worktree you are standing in, once its PR has merged.
#
# Not run by hand. A PostToolUse hook on `gh pr merge` (.claude/settings.json)
# invokes it and feeds it the tool payload on stdin — that payload is how it
# knows which worktree the merge happened in. The reclaim exists as a hook
# precisely because nobody should have to remember it: a branch database bills
# until it is deleted.
#
# It reclaims THIS worktree and no other. Every other worktree belongs to
# another session that may be mid-flight, and its branch database is live, so a
# sweep would break the one rule the whole wt:* family is built on.
#
# The guards that matter already live in wt:rm: it refuses a dirty tree, refuses
# unpushed commits, refuses the main checkout, and stops rather than orphaning a
# billing branch DB if the Supabase delete fails. So this script decides WHETHER
# to reclaim and delegates the reclaiming. What it adds is the one question
# wt:rm cannot answer: did the PR for this branch actually merge?
#
# Speaks JSON on stdout for the hook. Nothing else may be printed there.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/worktree-common.sh
source "$SCRIPT_DIR/lib/worktree-common.sh"
# A hook that exits non-zero reads as a broken hook. Past this point every
# outcome is reported, not raised.
set +e

emit() { # emit <message-for-the-user> [context-for-claude]
  jq -nc --arg m "$1" --arg c "${2:-}" \
    '{systemMessage: $m} + (if $c == "" then {} else
      {hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}} end)'
  exit 0
}

command -v jq >/dev/null 2>&1 || exit 0

payload=$(cat 2>/dev/null || echo '{}')

# The `if` filter in settings.json already narrows this to `gh pr merge`, but
# the filter is config and this is the thing that deletes a database.
cmd=$(jq -r '.tool_input.command // ""' <<<"$payload" 2>/dev/null)
[[ "$cmd" == *"gh pr merge"* ]] || exit 0

# The merge happened wherever the session was standing, which is the worktree to
# reclaim. pwd is a fallback for builds that do not send cwd.
cwd=$(jq -r '.cwd // ""' <<<"$payload" 2>/dev/null)
[ -n "$cwd" ] && [ -d "$cwd" ] || cwd=$(pwd -P)
cd "$cwd" 2>/dev/null || exit 0

primary=$(wt_primary_path 2>/dev/null) || exit 0
here=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
here=$(cd "$here" && pwd -P)
# Standing in the main checkout: nothing of ours to reclaim.
[ "$here" != "$primary" ] || exit 0

branch=$(wt_branch_for_path "$here" 2>/dev/null)
[ -n "$branch" ] || exit 0

# The merge has to be THIS branch's. `gh pr merge 12` run from an unrelated
# worktree would otherwise reap a branch nobody merged.
state=$(gh pr view --json state -q .state 2>/dev/null)
[ "$state" = "MERGED" ] || emit "Worktree kept: the PR for '$branch' is ${state:-not found}, not MERGED."

out=$(cd "$primary" && pnpm wt:rm "$branch" 2>&1)
if [ $? -ne 0 ]; then
  # wt:rm explains itself through wt_die ("Error: ..."); anything else is a
  # surprise, and the full output goes to Claude either way.
  why=$(sed -n 's/^Error: //p' <<<"$out" | tail -1)
  emit "Could not reclaim '$branch' — worktree left in place.${why:+ $why}" \
       "pnpm wt:rm $branch did not complete. Show the user this output and let them decide:"$'\n'"$out"
fi

note="Reclaimed the '$branch' worktree, its simulator and its branch DB."

cd "$primary" 2>/dev/null || emit "$note"
before=$(git rev-parse HEAD 2>/dev/null)
git pull --quiet --ff-only 2>/dev/null
after=$(git rev-parse HEAD 2>/dev/null)
if [ "$before" != "$after" ]; then
  note="$note Pulled master."
fi

emit "$note" "The worktree at $here is gone. Work from $primary from here on. $note"
