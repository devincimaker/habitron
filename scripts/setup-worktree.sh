#!/bin/bash
set -euo pipefail

# Setup script for Conductor worktrees.
# Copies .env files from the main repo and allocates unique ports/simulators.

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

# --- Safety checks ---

CURRENT_DIR=$(pwd -P)
MAIN_REPO=$(git worktree list | grep '\[master\]' | awk '{print $1}')

if [ -z "$MAIN_REPO" ]; then
  echo "ERROR: Could not find the main repo (no worktree on [master])."
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

# --- Scan existing worktrees for allocated resources ---

USED_SIMULATORS=()
USED_EXPO_PORTS=()
USED_API_PORTS=()

while IFS= read -r line; do
  WT_PATH=$(echo "$line" | awk '{print $1}')

  # Skip main repo and current worktree
  [ "$WT_PATH" = "$MAIN_REPO" ] && continue
  [ "$WT_PATH" = "$CURRENT_DIR" ] && continue

  # Read API port
  WT_API_ENV="$WT_PATH/apps/api/.env"
  if [ -f "$WT_API_ENV" ]; then
    PORT_VAL=$(grep '^PORT=' "$WT_API_ENV" 2>/dev/null | head -1 | cut -d= -f2)
    [ -n "${PORT_VAL:-}" ] && USED_API_PORTS+=("$PORT_VAL")
  fi

  # Read EXPO_PORT and IOS_SIMULATOR
  WT_MOBILE_ENV="$WT_PATH/apps/mobile/.env"
  if [ -f "$WT_MOBILE_ENV" ]; then
    EXPO_VAL=$(grep '^EXPO_PORT=' "$WT_MOBILE_ENV" 2>/dev/null | head -1 | cut -d= -f2)
    [ -n "${EXPO_VAL:-}" ] && USED_EXPO_PORTS+=("$EXPO_VAL")

    SIM_VAL=$(grep '^IOS_SIMULATOR=' "$WT_MOBILE_ENV" 2>/dev/null | head -1 | cut -d= -f2)
    [ -n "${SIM_VAL:-}" ] && USED_SIMULATORS+=("$SIM_VAL")
  fi
done < <(git worktree list)

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
  echo "ERROR: No simulators available. All are in use by other worktrees."
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
  echo "ERROR: No Expo ports available. All are in use by other worktrees."
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
  echo "ERROR: No API ports available. All are in use by other worktrees."
  exit 1
fi

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

echo ""
echo "Running pnpm install..."
pnpm install

# --- Summary ---

echo ""
echo "========================================="
echo " Worktree setup complete!"
echo "========================================="
echo " Path:          $CURRENT_DIR"
echo " API PORT:      $ALLOCATED_API_PORT"
echo " EXPO_PORT:     $ALLOCATED_EXPO_PORT"
echo " IOS_SIMULATOR: $ALLOCATED_SIMULATOR"
echo ""
echo " To start development:"
echo "   pnpm dev"
echo "========================================="
