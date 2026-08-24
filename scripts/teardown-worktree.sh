#!/usr/bin/env bash
set -uo pipefail

# Release everything the worktree you are standing in has claimed.
#
# - Deletes its Supabase branch database, if it has one
# - Kills Metro / the API server on its claimed ports
# - Deletes the simulator it created for itself
# - Releases the cross-repo reservation in ~/.conductor/state/resources.json
# - Deletes its .env files and its .env.worktree ledger
#
# Conductor invokes this on archive. `pnpm wt:rm <branch>` calls it too, from
# the main checkout, and then removes the worktree directory and the branch.
#
# Every step is best-effort except one: if the branch database cannot be
# deleted, this stops. Carrying on would erase the ledger that names the branch,
# and a branch nothing names is a branch billing hourly that nobody will find.

CURRENT_DIR=$(pwd -P)

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/worktree-common.sh
source "$SCRIPT_DIR/lib/worktree-common.sh"
# shellcheck source=lib/resource-registry.sh
source "$SCRIPT_DIR/lib/resource-registry.sh"

MAIN_REPO=$(wt_primary_path)

if [ "$CURRENT_DIR" = "$MAIN_REPO" ]; then
  echo "ERROR: Cannot run from the main checkout. Run this from inside a worktree."
  exit 1
fi

META="$CURRENT_DIR/.env.worktree"
MOBILE_ENV="$CURRENT_DIR/apps/mobile/.env"
API_ENV="$CURRENT_DIR/apps/api/.env"

# The ledger is the record; the .env files are the fallback for a worktree
# created before the ledger existed.
CLAIMED_EXPO_PORT=$(wt_read_value "$META" "WT_EXPO_PORT" 2>/dev/null || wt_read_value "$MOBILE_ENV" "EXPO_PORT" 2>/dev/null || true)
CLAIMED_API_PORT=$(wt_read_value "$META" "WT_API_PORT" 2>/dev/null || wt_read_value "$API_ENV" "PORT" 2>/dev/null || true)
CLAIMED_SIMULATOR=$(wt_read_value "$META" "WT_SIM_NAME" 2>/dev/null || wt_read_value "$MOBILE_ENV" "IOS_SIMULATOR" 2>/dev/null || true)
CLAIMED_SIM_UDID=$(wt_read_value "$META" "WT_SIM_UDID" 2>/dev/null || true)
[ -n "$CLAIMED_SIM_UDID" ] || CLAIMED_SIM_UDID=$(registry_get_simulator_udid "$CURRENT_DIR" 2>/dev/null || true)
BRANCH_DB=$(wt_read_value "$META" "WT_BRANCH_NAME" 2>/dev/null || true)

echo "Tearing down worktree: $CURRENT_DIR"

# --- branch database (the one step allowed to stop everything) ---------------

if [ -n "$BRANCH_DB" ]; then
  echo ""
  echo "Deleting Supabase branch database '$BRANCH_DB'..."
  presence=0
  wt_branch_presence "$BRANCH_DB" || presence=$?
  if [ "$presence" -eq 1 ]; then
    echo "  Already gone."
  else
    # presence 0 (exists) or 2 (could not tell) both mean: try the delete, and
    # refuse to continue if it does not succeed.
    if supabase branches delete "$BRANCH_DB" --project-ref "$WT_PROJECT_REF" --yes 2>/dev/null; then
      echo "  Deleted (billing stops)."
    else
      echo "" >&2
      echo "ERROR: could not delete branch database '$BRANCH_DB'." >&2
      echo "Stopping here on purpose: the ledger naming it is still intact, and" >&2
      echo "erasing that would leave the branch billing with nothing pointing at it." >&2
      echo "" >&2
      echo "  supabase branches delete $BRANCH_DB --project-ref $WT_PROJECT_REF" >&2
      echo "" >&2
      echo "Then re-run this teardown." >&2
      exit 1
    fi
  fi
  # Only now is it safe to forget the name.
  wt_upsert_env "$META" "WT_BRANCH_NAME" ""
  wt_upsert_env "$META" "WT_BRANCH_REF" ""
fi

# --- processes ---------------------------------------------------------------

# SIGTERM then SIGKILL after a short grace period. Safe if nothing is listening.
kill_port() {
  local port=$1
  [ -z "$port" ] && return 0
  local pids
  pids=$(lsof -ti "tcp:$port" 2>/dev/null || true)
  [ -z "$pids" ] && return 0
  echo "  Killing PID(s) on port $port: $pids"
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  for _ in 1 2 3; do
    sleep 1
    pids=$(lsof -ti "tcp:$port" 2>/dev/null || true)
    [ -z "$pids" ] && return 0
  done
  # shellcheck disable=SC2086
  kill -KILL $pids 2>/dev/null || true
}

echo ""
echo "Stopping processes on claimed ports..."
kill_port "$CLAIMED_EXPO_PORT"
kill_port "$CLAIMED_API_PORT"

# --- simulator ---------------------------------------------------------------
# The simulator was created for this worktree and named after it, so deleting it
# is correct and reclaims the disk. A simulator this worktree did not create
# (an older pool-allocated one, or the main checkout's) is only shut down.

if [ -n "$CLAIMED_SIM_UDID" ] && command -v xcrun >/dev/null 2>&1; then
  echo ""
  xcrun simctl shutdown "$CLAIMED_SIM_UDID" 2>/dev/null || true
  case "$CLAIMED_SIMULATOR" in
    thrive-*)
      echo "Deleting simulator '$CLAIMED_SIMULATOR' ($CLAIMED_SIM_UDID)..."
      xcrun simctl delete "$CLAIMED_SIM_UDID" 2>/dev/null \
        || echo "  (delete failed — continuing)"
      ;;
    *)
      echo "Shut down simulator '$CLAIMED_SIMULATOR' (not ours to delete)."
      ;;
  esac
elif [ -n "$CLAIMED_SIMULATOR" ]; then
  echo ""
  echo "No UDID recorded for '$CLAIMED_SIMULATOR' — skipping simctl."
fi

# --- registry and files ------------------------------------------------------

echo ""
echo "Releasing registry claim..."
registry_release "$CURRENT_DIR" || echo "  (registry release failed — continuing)"

echo ""
echo "Removing worktree files..."
[ -f "$API_ENV" ] && rm "$API_ENV" && echo "  Removed apps/api/.env"
[ -f "$MOBILE_ENV" ] && rm "$MOBILE_ENV" && echo "  Removed apps/mobile/.env"
[ -f "$META" ] && rm "$META" && echo "  Removed .env.worktree"

echo ""
echo "========================================="
echo " Teardown complete."
echo "========================================="
[ -n "$BRANCH_DB" ] && echo " Deleted branch DB:  $BRANCH_DB"
[ -n "$CLAIMED_SIMULATOR" ] && echo " Released simulator: $CLAIMED_SIMULATOR"
[ -n "$CLAIMED_EXPO_PORT" ] && echo " Released EXPO_PORT: $CLAIMED_EXPO_PORT"
[ -n "$CLAIMED_API_PORT" ] && echo " Released API PORT:  $CLAIMED_API_PORT"
echo "========================================="
