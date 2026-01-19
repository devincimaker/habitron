Do not try to keep old code around as "backwards compatibility" if it is not being used anymore. We are ok with changing code and removing old code to implement new patterns and systems.

## Development

To start the dev server (mobile app + API), run from the repo root:
```bash
pnpm dev
```

In worktrees, this will use the `IOS_SIMULATOR` and `EXPO_PORT` values from `apps/mobile/.env`.

## Supabase Migrations

When pushing database migrations:
- If working in a git worktree (tmp/feature-*), check if there's a Supabase branch database configured in the worktree's `.env` files. If the branch database credentials fail, STOP and ask the user before proceeding.
- If working from root directory, it's safe to push to the main database.
