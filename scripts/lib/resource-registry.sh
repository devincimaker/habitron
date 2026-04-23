#!/bin/bash
# Shared helpers for coordinating worktree resources (iOS simulator, Metro
# port, API port) across multiple app repos.
#
# Every app's setup/teardown script reads and writes the same JSON registry
# at ~/.conductor/state/resources.json so that e.g. the `thrive` and
# `habitron` repos never claim the same simulator at the same time.
#
# Source this file from a script; it does not run anything on its own.

REGISTRY_DIR="${CONDUCTOR_STATE_DIR:-$HOME/.conductor/state}"
REGISTRY_FILE="$REGISTRY_DIR/resources.json"
REGISTRY_LOCK="$REGISTRY_DIR/resources.lock"

registry_require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: 'jq' is required for the worktree resource registry." >&2
    echo "       Install with: brew install jq" >&2
    return 1
  fi
}

registry_init() {
  registry_require_jq || return 1
  mkdir -p "$REGISTRY_DIR"
  if [ ! -f "$REGISTRY_FILE" ]; then
    echo '{"version":1,"reservations":[]}' > "$REGISTRY_FILE"
  fi
}

# mkdir is atomic on POSIX, so it doubles as a cross-platform mutex
# (macOS lacks flock(1) by default).
_registry_lock() {
  local attempts=0
  local max_attempts=200  # ~10s at 50ms each
  while ! mkdir "$REGISTRY_LOCK" 2>/dev/null; do
    if [ -f "$REGISTRY_LOCK/pid" ]; then
      local holder
      holder=$(cat "$REGISTRY_LOCK/pid" 2>/dev/null || echo "")
      if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
        rm -rf "$REGISTRY_LOCK"
        continue
      fi
    fi
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      echo "ERROR: Could not acquire registry lock at $REGISTRY_LOCK" >&2
      return 1
    fi
    sleep 0.05
  done
  echo $$ > "$REGISTRY_LOCK/pid"
}

_registry_unlock() {
  rm -rf "$REGISTRY_LOCK"
}

_registry_reap_inner() {
  local tmp alive
  tmp=$(mktemp)
  alive="[]"
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if [ -d "$p" ]; then
      alive=$(jq --arg p "$p" '. + [$p]' <<<"$alive")
    fi
  done < <(jq -r '.reservations[].worktree' "$REGISTRY_FILE")
  jq --argjson alive "$alive" \
    '.reservations |= map(select(.worktree as $w | $alive | index($w)))' \
    "$REGISTRY_FILE" > "$tmp"
  mv "$tmp" "$REGISTRY_FILE"
}

registry_reap_stale() {
  registry_init || return 1
  _registry_lock || return 1
  local rc=0
  _registry_reap_inner || rc=$?
  _registry_unlock
  return $rc
}

registry_list_reserved_simulators() {
  registry_init || return 1
  jq -r '.reservations[].simulator // empty' "$REGISTRY_FILE"
}

registry_list_reserved_expo_ports() {
  registry_init || return 1
  jq -r '.reservations[].expoPort // empty' "$REGISTRY_FILE"
}

registry_list_reserved_api_ports() {
  registry_init || return 1
  jq -r '.reservations[].apiPort // empty' "$REGISTRY_FILE"
}

# Return the simulator UDID previously claimed for a given worktree (used
# by teardown to shut the right device down).
registry_get_simulator_udid() {
  registry_init || return 1
  local wt=$1
  jq -r --arg wt "$wt" \
    '.reservations[] | select(.worktree == $wt) | .simulatorUdid // empty' \
    "$REGISTRY_FILE"
}

_registry_claim_inner() {
  local wt=$1 slug=$2 sim=$3 udid=$4 expo=$5 api=$6
  local claimed_at tmp
  claimed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  tmp=$(mktemp)
  jq \
    --arg wt "$wt" \
    --arg slug "$slug" \
    --arg sim "$sim" \
    --arg udid "$udid" \
    --argjson expo "$expo" \
    --argjson api "$api" \
    --arg ts "$claimed_at" \
    --argjson pid "$$" \
    '.reservations |= (map(select(.worktree != $wt)) + [{
       worktree: $wt,
       repoSlug: $slug,
       simulator: $sim,
       simulatorUdid: $udid,
       expoPort: $expo,
       apiPort: $api,
       claimedAt: $ts,
       pid: $pid
     }])' \
    "$REGISTRY_FILE" > "$tmp"
  mv "$tmp" "$REGISTRY_FILE"
}

# registry_claim <worktree> <repoSlug> <sim> <simUdid> <expoPort> <apiPort>
registry_claim() {
  registry_init || return 1
  _registry_lock || return 1
  local rc=0
  _registry_claim_inner "$@" || rc=$?
  _registry_unlock
  return $rc
}

_registry_release_inner() {
  local wt=$1 tmp
  tmp=$(mktemp)
  jq --arg wt "$wt" '.reservations |= map(select(.worktree != $wt))' \
    "$REGISTRY_FILE" > "$tmp"
  mv "$tmp" "$REGISTRY_FILE"
}

registry_release() {
  registry_init || return 1
  _registry_lock || return 1
  local rc=0
  _registry_release_inner "$@" || rc=$?
  _registry_unlock
  return $rc
}
