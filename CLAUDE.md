Read and follow `AGENTS.md`: no backwards-compatibility code (single-user software — commit to the better approach and delete the old one), and remove features thoroughly (code, helpers, tests, migrations, docs) so the codebase stays at its minimum expression.

## Development

To start the dev server (mobile app + API), run from the repo root:
```bash
pnpm dev
```

In worktrees, this will use the `IOS_SIMULATOR` and `EXPO_PORT` values from `apps/mobile/.env`.

To install a Release build on a physical iPhone without EAS (Xcode automatic signing, hosted API URL baked in):
```bash
cd apps/mobile && pnpm build:device
```

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
- `scripts/create-worktree.sh` — manual entry point (`git worktree add` + setup). Use from Claude Code, Codex, or the terminal.
- `scripts/setup-worktree.sh` — runs inside an existing worktree. This is what Conductor invokes on workspace creation.
- `scripts/teardown-worktree.sh` — releases resources, kills dev processes, shuts down the simulator. Conductor invokes this on archive.
- `scripts/lib/resource-registry.sh` — shared registry helpers (not run directly).

Allocations live in a **global registry** at `~/.conductor/state/resources.json`, so any app repo using the same registry contract coordinates simulators and ports automatically. The main checkout's current `.env` values are also treated as reserved.

### Conductor configuration

Conductor stores repo settings in its own database, not in a repo-level config file. Configure once in the Conductor app (Repo settings → Scripts) with:

- **Setup script:** `./scripts/setup-worktree.sh`
- **Archive script:** `./scripts/teardown-worktree.sh`
- **Run script:** `pnpm dev`

### Cleanup

`pnpm worktree:teardown` (or Conductor's archive action) runs `scripts/teardown-worktree.sh`, which:
1. Kills any process listening on the worktree's claimed Metro/API ports (SIGTERM → SIGKILL).
2. Shuts down the claimed iOS simulator via its recorded UDID.
3. Removes the reservation from the global registry.
4. Deletes the worktree's `apps/api/.env` and `apps/mobile/.env`.

After teardown, run `git worktree remove <path>` if you also want the directory gone (Conductor does this automatically on archive).

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

## MCP server (`apps/mcp`)

Habitron's data is exposed to Claude Code / Claude Desktop through a local stdio MCP server so day planning can happen in a strong model with calendar/Linear/email context. See `apps/mcp/README.md` for the tool surface. The coaching skills that drive it live outside this repo in `~/Coach/.claude/skills`, and `~/Coach/.mcp.json` registers the server. It needs `apps/mcp/.env` (Supabase service role + `HABITRON_USER_ID`).

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
