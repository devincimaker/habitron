#!/bin/bash
set -euo pipefail

# Teardown script for Conductor worktrees.
# Removes .env files to de-allocate ports and simulators.

CURRENT_DIR=$(pwd -P)

resolve_main_repo() {
  local git_common_dir

  git_common_dir=$(git rev-parse --git-common-dir)
  git_common_dir=$(cd "$git_common_dir" && pwd -P)

  dirname "$git_common_dir"
}

MAIN_REPO=$(resolve_main_repo)

if [ "$CURRENT_DIR" = "$MAIN_REPO" ]; then
  echo "ERROR: Cannot run from the main repo. Run this from inside a worktree."
  exit 1
fi

echo "Removing worktree .env files..."

[ -f "$CURRENT_DIR/apps/api/.env" ] && rm "$CURRENT_DIR/apps/api/.env" && echo "  Removed apps/api/.env"
[ -f "$CURRENT_DIR/apps/mobile/.env" ] && rm "$CURRENT_DIR/apps/mobile/.env" && echo "  Removed apps/mobile/.env"

echo ""
echo "Ports and simulator de-allocated."
