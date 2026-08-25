#!/usr/bin/env bash
# Reclaim a worktree completely: its branch database, simulator, ports, the
# directory, and the local branch.
#
#   pnpm wt:rm feature/hab-73-optional-times
#   pnpm wt:rm /path/to/worktree
#   pnpm wt:rm <branch> --force        # ignore uncommitted or unpushed work
#
# Run from anywhere in the repo; it always operates on the named worktree, never
# on the one you are standing in by accident.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/worktree-common.sh
source "$SCRIPT_DIR/lib/worktree-common.sh"

force=""
wanted=""
for arg in "$@"; do
  case "$arg" in
    --force|-f) force=1 ;;
    -*)         wt_die "Unknown flag: $arg" ;;
    *)          wanted="$arg" ;;
  esac
done
[ -n "$wanted" ] || wt_die "Usage: pnpm wt:rm <branch|path> [--force]"

primary=$(wt_primary_path)

# Accept either a branch name or a path.
if [ -d "$wanted" ]; then
  target=$(cd "$wanted" && pwd -P)
  branch=$(wt_branch_for_path "$target")
else
  branch=$wanted
  target=$(wt_path_for_branch "$branch")
  [ -n "$target" ] || wt_die "No worktree is checked out on branch '$branch'. See: pnpm wt:list"
fi

[ "$target" != "$primary" ] || wt_die "Refusing to remove the main checkout."
[ -n "$branch" ] || wt_die "$target is on a detached HEAD — resolve that before removing it."

wt_step "Reclaiming $branch"
wt_info "path $target"

# --- guards ------------------------------------------------------------------

if [ -z "$force" ]; then
  dirty=$(git -C "$target" status --porcelain 2>/dev/null || true)
  if [ -n "$dirty" ]; then
    echo "$dirty" >&2
    wt_die "Uncommitted work in $target. Commit or stash it, then re-run (or pass --force)."
  fi

  if git -C "$target" rev-parse --verify --quiet '@{u}' >/dev/null 2>&1; then
    unpushed=$(git -C "$target" log '@{u}..' --oneline 2>/dev/null || true)
    if [ -n "$unpushed" ]; then
      echo "$unpushed" >&2
      wt_die "Unpushed commits on $branch. Push them, then re-run (or pass --force)."
    fi
  fi
fi

# --- release the resources, from inside ---------------------------------------
# Teardown stops rather than continuing if the branch database survives, so a
# non-zero exit here means nothing has been erased yet and the fix it printed is
# still the whole fix.

wt_step "Releasing claimed resources"
# The main checkout's teardown, run with the worktree as cwd — deliberately not
# "$target/scripts/teardown-worktree.sh". A worktree carries whatever version of
# these scripts its branch was cut from, and tearing down with stale logic is
# how a branch database created by a newer setup gets left behind billing.
(cd "$target" && "$primary/scripts/teardown-worktree.sh") \
  || wt_die "Teardown did not finish for $branch. The worktree is untouched; fix the reason above and re-run."

# --- remove ------------------------------------------------------------------

wt_step "Removing the worktree"
if ! git -C "$primary" worktree remove "$target" --force; then
  # git walks the tree and deletes as it goes, so anything still writing in
  # there makes the final rmdir fail with ENOTEMPTY. Teardown above is what
  # stops those, but a half-reclaim is the worst of the three outcomes: the
  # directory survives where `wt:list` cannot see it, and the branch below
  # outlives its own merge. Finish by hand rather than leave that.
  [ -n "$target" ] && [ "$target" != "$primary" ] && [ "$target" != "/" ] \
    || wt_die "Refusing to force-remove '$target'"
  wt_info "git could not remove it — deleting the directory and pruning"
  rm -rf "$target"
  git -C "$primary" worktree prune
fi
wt_info "removed $target"

if git -C "$primary" rev-parse --verify --quiet "refs/heads/$branch" >/dev/null 2>&1; then
  git -C "$primary" branch -D "$branch" >/dev/null
  wt_info "deleted local branch $branch"
fi

wt_step "Done"
wt_info "$branch is fully reclaimed."
