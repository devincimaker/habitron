#!/bin/bash
set -uo pipefail

# Teardown script for Conductor worktrees.
#
# - Reads the current claim from apps/*/.env
# - Kills any Metro / API server listening on the claimed ports
# - Shuts down the claimed iOS simulator (via UDID from the registry)
# - Releases the reservation in ~/.conductor/state/resources.json
# - Deletes the worktree's .env files
#
# Each step is best-effort: a failure in one does not abort the rest, so
# we never leave a registry entry dangling because (say) `kill` failed.

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

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/resource-registry.sh
source "$SCRIPT_DIR/lib/resource-registry.sh"

read_env_value() {
  local file_path=$1
  local key=$2
  if [ ! -f "$file_path" ]; then return 0; fi
  grep "^${key}=" "$file_path" 2>/dev/null | head -1 | cut -d= -f2-
}

# Capture the current claim from .env before we delete anything.
MOBILE_ENV="$CURRENT_DIR/apps/mobile/.env"
API_ENV="$CURRENT_DIR/apps/api/.env"

CLAIMED_SIMULATOR=$(read_env_value "$MOBILE_ENV" "IOS_SIMULATOR")
CLAIMED_EXPO_PORT=$(read_env_value "$MOBILE_ENV" "EXPO_PORT")
CLAIMED_API_PORT=$(read_env_value "$API_ENV" "PORT")
CLAIMED_SIM_UDID=$(registry_get_simulator_udid "$CURRENT_DIR" 2>/dev/null || true)

# SIGTERM then SIGKILL after a short grace period. Safe if nothing is
# listening on the port.
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

echo "Tearing down worktree: $CURRENT_DIR"

echo ""
echo "Stopping processes on claimed ports..."
kill_port "$CLAIMED_EXPO_PORT"
kill_port "$CLAIMED_API_PORT"

if [ -n "$CLAIMED_SIM_UDID" ] && command -v xcrun >/dev/null 2>&1; then
  echo ""
  echo "Shutting down simulator '$CLAIMED_SIMULATOR' ($CLAIMED_SIM_UDID)..."
  xcrun simctl shutdown "$CLAIMED_SIM_UDID" 2>/dev/null || \
    echo "  (simulator was not booted or shutdown failed — continuing)"
elif [ -n "$CLAIMED_SIMULATOR" ]; then
  echo ""
  echo "No UDID recorded for '$CLAIMED_SIMULATOR' — skipping simctl shutdown."
fi

echo ""
echo "Releasing registry claim..."
registry_release "$CURRENT_DIR" || echo "  (registry release failed — continuing)"

echo ""
echo "Removing .env files..."
[ -f "$API_ENV" ] && rm "$API_ENV" && echo "  Removed apps/api/.env"
[ -f "$MOBILE_ENV" ] && rm "$MOBILE_ENV" && echo "  Removed apps/mobile/.env"

echo ""
echo "========================================="
echo " Teardown complete."
echo "========================================="
[ -n "$CLAIMED_SIMULATOR" ] && echo " Released simulator: $CLAIMED_SIMULATOR"
[ -n "$CLAIMED_EXPO_PORT" ] && echo " Released EXPO_PORT: $CLAIMED_EXPO_PORT"
[ -n "$CLAIMED_API_PORT" ] && echo " Released API PORT:  $CLAIMED_API_PORT"
echo "========================================="
