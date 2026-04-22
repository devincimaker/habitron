#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/create-worktree.sh [--skip-install] <branch-name> [worktree-name]

Examples:
  scripts/create-worktree.sh feature/habit-skill
  scripts/create-worktree.sh --skip-install fix/coach-crash coach-crash

Environment:
  WORKTREE_ROOT         Override the parent directory used for new worktrees.
  WORKTREE_SKIP_INSTALL Passed through to scripts/setup-worktree.sh.
EOF
}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
SETUP_SCRIPT="$SCRIPT_DIR/setup-worktree.sh"

resolve_main_repo() {
  local git_common_dir

  git_common_dir=$(git rev-parse --git-common-dir)
  git_common_dir=$(cd "$git_common_dir" && pwd -P)

  dirname "$git_common_dir"
}

read_env_value() {
  local file_path=$1
  local key=$2

  if [ ! -f "$file_path" ]; then
    return 0
  fi

  if grep -q "^${key}=" "$file_path" 2>/dev/null; then
    grep "^${key}=" "$file_path" 2>/dev/null | head -1 | cut -d= -f2-
  fi
}

resolve_default_base_ref() {
  local repo_path=$1
  local remote_head_ref

  if git -C "$repo_path" show-ref --verify --quiet "refs/heads/master"; then
    echo "master"
    return 0
  fi

  if git -C "$repo_path" show-ref --verify --quiet "refs/remotes/origin/master"; then
    echo "origin/master"
    return 0
  fi

  remote_head_ref=$(git -C "$repo_path" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [ -n "$remote_head_ref" ]; then
    echo "$remote_head_ref"
    return 0
  fi

  return 1
}

resolve_remote_branch_ref() {
  local repo_path=$1
  local branch_name=$2
  local remote_ref=""
  local match_count=0

  if git -C "$repo_path" show-ref --verify --quiet "refs/remotes/origin/$branch_name"; then
    echo "origin/$branch_name"
    return 0
  fi

  while IFS= read -r ref_name; do
    [ -n "$ref_name" ] || continue
    remote_ref=${ref_name#refs/remotes/}
    match_count=$((match_count + 1))
  done < <(git -C "$repo_path" for-each-ref --format='%(refname)' "refs/remotes/*/$branch_name")

  if [ "$match_count" -eq 1 ]; then
    echo "$remote_ref"
    return 0
  fi

  if [ "$match_count" -gt 1 ]; then
    echo "ERROR: Branch $branch_name exists on multiple remotes. Create the local branch first." >&2
    exit 1
  fi

  return 1
}

readarray_fallback() {
  local cmd=$1
  if command -v mapfile >/dev/null 2>&1; then
    mapfile -t WORKTREE_PATHS < <(eval "$cmd")
  else
    WORKTREE_PATHS=()
    while IFS= read -r line; do
      WORKTREE_PATHS+=("$line")
    done < <(eval "$cmd")
  fi
}

SKIP_INSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      continue
      ;;
    -*)
      echo "ERROR: Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage >&2
  exit 1
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ERROR: Not inside a git repository." >&2
  exit 1
fi

BRANCH_NAME=$1
WORKTREE_NAME=${2:-${BRANCH_NAME//\//-}}

MAIN_REPO=$(resolve_main_repo)
if [ -z "${MAIN_REPO:-}" ] || [ ! -d "$MAIN_REPO/.git" ]; then
  echo "ERROR: Could not determine the main repo checkout." >&2
  exit 1
fi

readarray_fallback "git -C \"$MAIN_REPO\" worktree list --porcelain | awk -v main_repo=\"$MAIN_REPO\" '/^worktree / { path = substr(\$0, 10); if (path != main_repo) print path }'"

DEFAULT_WORKTREE_ROOT=""
if [ ${#WORKTREE_PATHS[@]} -gt 0 ]; then
  DEFAULT_WORKTREE_ROOT=$(dirname "${WORKTREE_PATHS[0]}")
else
  DEFAULT_WORKTREE_ROOT="$HOME/conductor/workspaces/$(basename "$MAIN_REPO")"
fi

WORKTREE_ROOT=${WORKTREE_ROOT:-$DEFAULT_WORKTREE_ROOT}
WORKTREE_PATH="${WORKTREE_ROOT%/}/$WORKTREE_NAME"

if [ -e "$WORKTREE_PATH" ]; then
  echo "ERROR: Worktree path already exists: $WORKTREE_PATH" >&2
  exit 1
fi

mkdir -p "$WORKTREE_ROOT"

WORKTREE_CREATED=0
SETUP_COMPLETED=0
BRANCH_CREATED=0

cleanup_on_exit() {
  local exit_code=$1

  if [ "$exit_code" -ne 0 ] && [ "$WORKTREE_CREATED" = "1" ] && [ "$SETUP_COMPLETED" = "0" ]; then
    echo ""
    echo "Setup failed. Removing incomplete worktree..."
    git -C "$MAIN_REPO" worktree remove --force "$WORKTREE_PATH" >/dev/null 2>&1 || true

    if [ "$BRANCH_CREATED" = "1" ] && git -C "$MAIN_REPO" show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
      git -C "$MAIN_REPO" branch -D "$BRANCH_NAME" >/dev/null 2>&1 || true
    fi
  fi
}

trap 'cleanup_on_exit "$?"' EXIT

if git -C "$MAIN_REPO" show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "Creating worktree from existing branch $BRANCH_NAME..."
  git -C "$MAIN_REPO" worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
elif REMOTE_BRANCH_REF=$(resolve_remote_branch_ref "$MAIN_REPO" "$BRANCH_NAME"); then
  echo "Creating worktree from remote branch $REMOTE_BRANCH_REF..."
  git -C "$MAIN_REPO" worktree add --track -b "$BRANCH_NAME" "$WORKTREE_PATH" "$REMOTE_BRANCH_REF"
  BRANCH_CREATED=1
else
  BASE_REF=$(resolve_default_base_ref "$MAIN_REPO") || {
    echo "ERROR: Could not determine a base branch for new worktrees." >&2
    exit 1
  }
  echo "Creating worktree and branch $BRANCH_NAME from $BASE_REF..."
  git -C "$MAIN_REPO" worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_REF"
  BRANCH_CREATED=1
fi
WORKTREE_CREATED=1

echo ""
echo "Configuring worktree resources..."
if [ "$SKIP_INSTALL" = "1" ]; then
  (
    cd "$WORKTREE_PATH"
    WORKTREE_SKIP_INSTALL=1 "$SETUP_SCRIPT"
  )
else
  (
    cd "$WORKTREE_PATH"
    "$SETUP_SCRIPT"
  )
fi
SETUP_COMPLETED=1

MOBILE_ENV="$WORKTREE_PATH/apps/mobile/.env"
API_ENV="$WORKTREE_PATH/apps/api/.env"
IOS_SIMULATOR=$(read_env_value "$MOBILE_ENV" "IOS_SIMULATOR")
EXPO_PORT=$(read_env_value "$MOBILE_ENV" "EXPO_PORT")
API_PORT=$(read_env_value "$API_ENV" "PORT")

echo ""
echo "========================================="
echo " Worktree created"
echo "========================================="
echo " Path:          $WORKTREE_PATH"
echo " Branch:        $BRANCH_NAME"
echo " API PORT:      ${API_PORT:-unknown}"
echo " EXPO_PORT:     ${EXPO_PORT:-unknown}"
echo " IOS_SIMULATOR: ${IOS_SIMULATOR:-unknown}"
echo "========================================="
