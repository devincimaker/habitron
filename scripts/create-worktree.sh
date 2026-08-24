#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/create-worktree.sh [--db] [--no-sim] [--skip-install] [--base <ref>] <branch-name> [worktree-name]

Examples:
  scripts/create-worktree.sh feature/habit-skill
  scripts/create-worktree.sh --db feature/hab-80-streak-table
  scripts/create-worktree.sh --no-sim chore/hab-81-dead-code
  scripts/create-worktree.sh --base origin/master feature/habit-skill
  scripts/create-worktree.sh --skip-install fix/coach-crash coach-crash

Routing:
  --db      give the branch its own hosted Supabase branch database. Choose this
            when the work implies schema: migrations, RLS, RPCs, triggers, new
            tables or columns. Costs money and minutes; ambiguous means shared.
  --no-sim  skip the simulator. Choose this when nothing on screen changes.

  Both are cheap to reverse later: pnpm wt:setup --db / --sim.

Environment:
  WORKTREE_ROOT         Override the parent directory used for new worktrees.
  WORKTREE_SKIP_INSTALL Set to 1 to skip pnpm install.

By default, new branches are created from the caller's current HEAD.
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

resolve_current_repo() {
  local repo_path

  repo_path=$(git rev-parse --show-toplevel)
  repo_path=$(cd "$repo_path" && pwd -P)
  echo "$repo_path"
}

resolve_repo_slug() {
  local repo_path=$1
  local remote_url
  local slug

  remote_url=$(git -C "$repo_path" config --get remote.origin.url 2>/dev/null || true)
  if [ -n "$remote_url" ]; then
    slug=${remote_url##*/}
    slug=${slug%.git}
    if [ -n "$slug" ]; then
      echo "$slug"
      return 0
    fi
  fi

  basename "$repo_path"
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

fetch_remotes_or_fail() {
  local repo_path=$1
  local branch_name=$2

  if [ -z "$(git -C "$repo_path" remote)" ]; then
    return 0
  fi

  echo "Fetching remotes before deciding whether $branch_name is new..."
  if ! git -C "$repo_path" fetch --all --prune; then
    echo "ERROR: Could not fetch remotes. Refusing to assume $branch_name is new from stale refs." >&2
    exit 1
  fi
}

resolve_base_ref() {
  local repo_path=$1
  local caller_repo=$2
  local base_ref=${3:-}

  if [ -n "$base_ref" ]; then
    if git -C "$caller_repo" rev-parse --verify --quiet "$base_ref^{commit}" >/dev/null; then
      git -C "$caller_repo" rev-parse --verify "$base_ref^{commit}"
      return 0
    fi

    if git -C "$repo_path" rev-parse --verify --quiet "$base_ref^{commit}" >/dev/null; then
      git -C "$repo_path" rev-parse --verify "$base_ref^{commit}"
      return 0
    fi

    echo "ERROR: Base ref not found: $base_ref" >&2
    return 1
  fi

  git -C "$caller_repo" rev-parse --verify HEAD
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

SKIP_INSTALL=${WORKTREE_SKIP_INSTALL:-0}
BASE_REF_ARG=""
SETUP_FLAGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --db|--no-db|--sim|--no-sim)
      SETUP_FLAGS+=("$1")
      shift
      ;;
    -b|--base)
      if [ $# -lt 2 ]; then
        echo "ERROR: $1 requires a ref argument." >&2
        usage >&2
        exit 1
      fi
      BASE_REF_ARG=$2
      shift 2
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

CALLER_REPO=$(resolve_current_repo)
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
  DEFAULT_WORKTREE_ROOT="$HOME/conductor/workspaces/$(resolve_repo_slug "$MAIN_REPO")"
  echo "WARNING: No existing worktree root found. Defaulting to $DEFAULT_WORKTREE_ROOT." >&2
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

# A worktree that exists is never deleted on failure. Setup is idempotent and
# prints its own retry line, and by the time it can fail it may already own a
# billable Supabase branch recorded only in that worktree's ledger — deleting
# the directory would orphan it.
cleanup_on_exit() {
  local exit_code=$1

  if [ "$exit_code" -ne 0 ] && [ "$WORKTREE_CREATED" = "1" ] && [ "$SETUP_COMPLETED" = "0" ]; then
    echo ""
    echo "The worktree was created but setup did not finish. It is left in place."
    echo "Finish it with:"
    echo "  pnpm wt:setup $WORKTREE_PATH ${SETUP_FLAGS[*]-}"
    echo "Or reclaim it entirely with:"
    echo "  pnpm wt:rm $BRANCH_NAME --force"
  fi
}

# "$?" is expanded when the EXIT trap fires, preserving the real failure code.
trap 'cleanup_on_exit "$?"' EXIT

if git -C "$MAIN_REPO" show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "Creating worktree from existing branch $BRANCH_NAME..."
  git -C "$MAIN_REPO" worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
  fetch_remotes_or_fail "$MAIN_REPO" "$BRANCH_NAME"

  if REMOTE_BRANCH_REF=$(resolve_remote_branch_ref "$MAIN_REPO" "$BRANCH_NAME"); then
    echo "Creating worktree from remote branch $REMOTE_BRANCH_REF..."
    git -C "$MAIN_REPO" worktree add --track -b "$BRANCH_NAME" "$WORKTREE_PATH" "$REMOTE_BRANCH_REF"
    BRANCH_CREATED=1
  else
    BASE_REF=$(resolve_base_ref "$MAIN_REPO" "$CALLER_REPO" "$BASE_REF_ARG") || exit 1
    if [ -n "$BASE_REF_ARG" ]; then
      echo "Creating worktree and branch $BRANCH_NAME from $BASE_REF_ARG..."
    else
      echo "Creating worktree and branch $BRANCH_NAME from caller HEAD $(git -C "$CALLER_REPO" rev-parse --short "$BASE_REF")..."
    fi
    git -C "$MAIN_REPO" worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_REF"
    BRANCH_CREATED=1
  fi
fi
WORKTREE_CREATED=1

echo ""
echo "Configuring worktree resources..."
(
  cd "$WORKTREE_PATH"
  if [ "$SKIP_INSTALL" = "1" ]; then
    export WORKTREE_SKIP_INSTALL=1
  fi
  "$SETUP_SCRIPT" "${SETUP_FLAGS[@]-}"
)
SETUP_COMPLETED=1

MOBILE_ENV="$WORKTREE_PATH/apps/mobile/.env"
API_ENV="$WORKTREE_PATH/apps/api/.env"
IOS_SIMULATOR=$(read_env_value "$MOBILE_ENV" "IOS_SIMULATOR")
EXPO_PORT=$(read_env_value "$MOBILE_ENV" "EXPO_PORT")
API_PORT=$(read_env_value "$API_ENV" "PORT")
DB_MODE=$(read_env_value "$WORKTREE_PATH/.env.worktree" "WT_DB_MODE")

echo ""
echo "========================================="
echo " Worktree created"
echo "========================================="
echo " Path:          $WORKTREE_PATH"
echo " Branch:        $BRANCH_NAME"
echo " API PORT:      ${API_PORT:-unknown}"
echo " EXPO_PORT:     ${EXPO_PORT:-unknown}"
echo " IOS_SIMULATOR: ${IOS_SIMULATOR:-unknown}"
echo " DB mode:       ${DB_MODE:-unknown}"
echo "========================================="
echo ""
echo " cd $WORKTREE_PATH && pnpm dev"
