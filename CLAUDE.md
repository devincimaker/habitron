Do not try to keep old code around as "backwards compatibility" if it is not being used anymore. We are ok with changing code and removing old code to implement new patterns and systems.

## Development

To start the dev server (mobile app + API), run from the repo root:
```bash
pnpm dev
```

In worktrees, this will use the `IOS_SIMULATOR` and `EXPO_PORT` values from `apps/mobile/.env`.

## Worktrees

Use the repo-owned command to create worktrees:
```bash
pnpm worktree:create -- <branch-name> [worktree-name]
```

This command creates the git worktree, copies the `.env` files, allocates a simulator and ports, and prints the assigned resources.

If you need the raw script entry point:
```bash
scripts/create-worktree.sh <branch-name> [worktree-name]
```

Resource allocation is determined by executable scripts, not by hardcoded markdown. Treat these as the source of truth:
- `scripts/create-worktree.sh`
- `scripts/setup-worktree.sh`
- `scripts/teardown-worktree.sh`

The main checkout's current `.env` values are treated as reserved when allocating worktree resources.

### iOS Simulator

**CRITICAL:** Always use the simulator specified in `apps/mobile/.env` (`IOS_SIMULATOR`). Never use a different simulator, even if:
- Another simulator is already booted
- The assigned simulator appears to be in use
- The assigned simulator is shut down (boot it first)

Read the `.env` file to get the simulator name, then use that exact simulator for all operations.

#### Building and Launching

**Always use `--no-bundler`** when building with Expo to prevent deep link issues that can launch the app on the wrong simulator:

```bash
# 1. Get the simulator UDID
UDID=$(xcrun simctl list devices | grep "$IOS_SIMULATOR (" | head -1 | grep -oE '[A-F0-9-]{36}')

# 2. Build and install (without launching via deep link)
cd apps/mobile && npx expo run:ios --device "$IOS_SIMULATOR" --no-bundler

# 3. Start Metro on the configured port (if not already running)
npx expo start --port $EXPO_PORT &

# 4. Launch the app with a deep link to the correct Metro port
xcrun simctl openurl "$UDID" "exp+habits-coach://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$EXPO_PORT"
```

**Why?**
- Expo's deep links can open on any booted simulator with the app installed, not the one you specified. Using `--no-bundler` and launching by UDID ensures the correct simulator.
- The Dev Client discovers all Metro bundlers on the network. Using `openurl` with the specific port URL forces it to connect to the correct one instead of showing a picker or auto-connecting to the wrong server.

## Supabase Migrations

When pushing database migrations:
- Resolve the main checkout with `git rev-parse --git-common-dir`; if the current checkout path differs from that main checkout, treat it as a git worktree regardless of directory name.
- In a worktree, check whether there's a Supabase branch database configured in the worktree's `.env` files. If the branch database credentials fail, STOP and ask the user before proceeding.
- If working from the main checkout, it's safe to push to the main database.

## Linear Integration

- **Workspace**: daio
- **Team**: Habitron team
- **Project URL**: https://linear.app/daio/team/HAB/all
- **Issue Identifier**: HAB
