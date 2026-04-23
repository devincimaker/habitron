#!/bin/bash
set -euo pipefail

# Setup script for Conductor worktrees.
# Copies .env files from the main repo and allocates unique ports/simulators.
#
# Allocations are coordinated through ~/.conductor/state/resources.json
# (see scripts/lib/resource-registry.sh), so multiple app repos can share
# the same simulator/port pools without colliding. The main checkout's
# current .env values are also honored as reserved.

# --- Resource pools (order matters — first available is picked) ---

SIMULATOR_POOL=(
  "iPhone 16"
  "iPhone 16 Pro"
  "iPhone 16 Pro Max"
  "iPhone 16e"
  "iPhone 16 - Side Hoe"
)
EXPO_PORT_POOL=(8082 8083 8084 8085 8086)
API_PORT_POOL=(3002 3003 3004 3005 3006)

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

# --- Safety checks ---

CURRENT_DIR=$(pwd -P)
MAIN_REPO=$(resolve_main_repo)

if [ -z "$MAIN_REPO" ] || [ ! -d "$MAIN_REPO/.git" ]; then
  echo "ERROR: Could not determine the main repo checkout."
  exit 1
fi

if [ "$CURRENT_DIR" = "$MAIN_REPO" ]; then
  echo "ERROR: Cannot run from the main repo. Run this from inside a worktree."
  exit 1
fi

# --- Validate source .env files ---

MAIN_API_ENV="$MAIN_REPO/apps/api/.env"
MAIN_MOBILE_ENV="$MAIN_REPO/apps/mobile/.env"

if [ ! -f "$MAIN_API_ENV" ]; then
  echo "ERROR: Source file not found: $MAIN_API_ENV"
  exit 1
fi
if [ ! -f "$MAIN_MOBILE_ENV" ]; then
  echo "ERROR: Source file not found: $MAIN_MOBILE_ENV"
  exit 1
fi

# --- Copy .env files (always overwrite for idempotency) ---

echo "Copying .env files from main repo..."
cp "$MAIN_API_ENV" "$CURRENT_DIR/apps/api/.env"
cp "$MAIN_MOBILE_ENV" "$CURRENT_DIR/apps/mobile/.env"
echo "  Copied apps/api/.env"
echo "  Copied apps/mobile/.env"

# --- Load the shared resource registry ---

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib/resource-registry.sh
source "$SCRIPT_DIR/lib/resource-registry.sh"

registry_init
registry_reap_stale
# Drop any prior claim for this worktree so re-running setup is idempotent.
registry_release "$CURRENT_DIR"

# --- Gather reserved resources (registry across all apps + main .env) ---

USED_SIMULATORS=()
USED_EXPO_PORTS=()
USED_API_PORTS=()

while IFS= read -r val; do
  [ -n "$val" ] && USED_SIMULATORS+=("$val")
done < <(registry_list_reserved_simulators)
while IFS= read -r val; do
  [ -n "$val" ] && USED_EXPO_PORTS+=("$val")
done < <(registry_list_reserved_expo_ports)
while IFS= read -r val; do
  [ -n "$val" ] && USED_API_PORTS+=("$val")
done < <(registry_list_reserved_api_ports)

MAIN_SIMULATOR=$(read_env_value "$MAIN_MOBILE_ENV" "IOS_SIMULATOR")
MAIN_EXPO_PORT=$(read_env_value "$MAIN_MOBILE_ENV" "EXPO_PORT")
MAIN_API_PORT=$(read_env_value "$MAIN_API_ENV" "PORT")

[ -n "${MAIN_SIMULATOR:-}" ] && USED_SIMULATORS+=("$MAIN_SIMULATOR")
[ -n "${MAIN_EXPO_PORT:-}" ] && USED_EXPO_PORTS+=("$MAIN_EXPO_PORT")
[ -n "${MAIN_API_PORT:-}" ] && USED_API_PORTS+=("$MAIN_API_PORT")

# --- Allocate resources (first unused from each pool) ---

ALLOCATED_SIMULATOR=""
for sim in "${SIMULATOR_POOL[@]}"; do
  FOUND=false
  for used in "${USED_SIMULATORS[@]+"${USED_SIMULATORS[@]}"}"; do
    if [ "$sim" = "$used" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" = false ]; then
    ALLOCATED_SIMULATOR="$sim"
    break
  fi
done
if [ -z "$ALLOCATED_SIMULATOR" ]; then
  echo "ERROR: No simulators available. All are claimed by other worktrees or apps."
  echo "       Check: jq '.reservations[].simulator' ~/.conductor/state/resources.json"
  exit 1
fi

ALLOCATED_EXPO_PORT=""
for port in "${EXPO_PORT_POOL[@]}"; do
  FOUND=false
  for used in "${USED_EXPO_PORTS[@]+"${USED_EXPO_PORTS[@]}"}"; do
    if [ "$port" = "$used" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" = false ]; then
    ALLOCATED_EXPO_PORT="$port"
    break
  fi
done
if [ -z "$ALLOCATED_EXPO_PORT" ]; then
  echo "ERROR: No Expo ports available. All are claimed by other worktrees or apps."
  exit 1
fi

ALLOCATED_API_PORT=""
for port in "${API_PORT_POOL[@]}"; do
  FOUND=false
  for used in "${USED_API_PORTS[@]+"${USED_API_PORTS[@]}"}"; do
    if [ "$port" = "$used" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" = false ]; then
    ALLOCATED_API_PORT="$port"
    break
  fi
done
if [ -z "$ALLOCATED_API_PORT" ]; then
  echo "ERROR: No API ports available. All are claimed by other worktrees or apps."
  exit 1
fi

# --- Resolve simulator UDID so teardown can target it precisely ---

ALLOCATED_SIMULATOR_UDID=""
if command -v xcrun >/dev/null 2>&1; then
  ALLOCATED_SIMULATOR_UDID=$(xcrun simctl list devices available 2>/dev/null \
    | grep " ${ALLOCATED_SIMULATOR} (" \
    | head -1 \
    | grep -oE '[A-F0-9-]{36}' || true)
fi
if [ -z "$ALLOCATED_SIMULATOR_UDID" ]; then
  echo "WARNING: Could not resolve UDID for '$ALLOCATED_SIMULATOR'."
  echo "         Teardown will skip simulator shutdown for this worktree."
fi

# --- Claim in the registry before touching .env files ---

REPO_SLUG=$(basename "$MAIN_REPO")
registry_claim \
  "$CURRENT_DIR" \
  "$REPO_SLUG" \
  "$ALLOCATED_SIMULATOR" \
  "$ALLOCATED_SIMULATOR_UDID" \
  "$ALLOCATED_EXPO_PORT" \
  "$ALLOCATED_API_PORT"

# If anything downstream fails, release the claim and wipe the .env files.
rollback_on_failure() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "" >&2
    echo "Setup failed (exit $rc) — releasing registry claim and removing .env files." >&2
    registry_release "$CURRENT_DIR" || true
    rm -f "$CURRENT_DIR/apps/api/.env" "$CURRENT_DIR/apps/mobile/.env"
  fi
}
trap rollback_on_failure EXIT

# --- Patch .env files with allocated resources ---

# apps/api/.env — update PORT
sed -i '' "s/^PORT=.*/PORT=$ALLOCATED_API_PORT/" "$CURRENT_DIR/apps/api/.env"

# apps/mobile/.env — update API URL
sed -i '' "s|EXPO_PUBLIC_API_URL=http://localhost:[0-9]*|EXPO_PUBLIC_API_URL=http://localhost:$ALLOCATED_API_PORT|" "$CURRENT_DIR/apps/mobile/.env"

# Remove any existing worktree-specific lines (for idempotency on re-runs)
sed -i '' '/^IOS_SIMULATOR=/d' "$CURRENT_DIR/apps/mobile/.env"
sed -i '' '/^EXPO_PORT=/d' "$CURRENT_DIR/apps/mobile/.env"
sed -i '' '/^# Worktree-specific settings$/d' "$CURRENT_DIR/apps/mobile/.env"

# Append worktree-specific settings
cat >> "$CURRENT_DIR/apps/mobile/.env" << EOF

# Worktree-specific settings
IOS_SIMULATOR=$ALLOCATED_SIMULATOR
EXPO_PORT=$ALLOCATED_EXPO_PORT
EOF

# --- Install dependencies ---

if [ "${WORKTREE_SKIP_INSTALL:-0}" = "1" ]; then
  echo ""
  echo "Skipping pnpm install because WORKTREE_SKIP_INSTALL=1."
else
  echo ""
  echo "Running pnpm install..."
  pnpm install
fi

# --- Summary ---

echo ""
echo "========================================="
echo " Worktree setup complete!"
echo "========================================="
echo " Path:          $CURRENT_DIR"
echo " API PORT:      $ALLOCATED_API_PORT"
echo " EXPO_PORT:     $ALLOCATED_EXPO_PORT"
echo " IOS_SIMULATOR: $ALLOCATED_SIMULATOR"
if [ -n "$ALLOCATED_SIMULATOR_UDID" ]; then
  echo " Simulator UDID:$ALLOCATED_SIMULATOR_UDID"
fi
echo " Registry:      $REGISTRY_FILE"
echo ""
echo " To start development:"
echo "   pnpm dev"
echo "========================================="
