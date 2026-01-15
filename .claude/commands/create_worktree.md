---
description: Create a new git worktree with branch, copy .env files, and optionally set up Supabase branch database
---

# Create Worktree

Create a new git worktree for isolated feature development.

## Resource Pools

**Reserved for main** (do not allocate to worktrees):
- Simulator: iPhone 16 Plus
- EXPO_PORT: 8081
- API PORT: 3001

**Available for worktrees** (allocate in order):
- Simulators: iPhone 16, iPhone 16 Pro, iPhone 16 Pro Max, iPhone 16e, iPhone 16 - Side Hoe
- EXPO_PORT: 8082, 8083, 8084, 8085, 8086
- API PORT: 3002, 3003, 3004, 3005, 3006

## Steps

1. **Ask the work type**: What kind of work? (feature, fix, refactor, chore)

2. **Ask about Supabase**: Do they want a branch database? (Yes/No)

3. **Ask for description**: Brief description of what to implement (e.g., "mini-calendar", "user settings page")

4. **Generate branch name** from type and description: `{type}/{description-kebab-case}`

5. **Scan existing worktrees** to find allocated resources:
   ```bash
   git worktree list
   ```
   For each worktree in `tmp/`, spawn parallel subagents to read:
   - `apps/mobile/.env` → extract `EXPO_PORT` and `IOS_SIMULATOR`
   - `apps/api/.env` → extract `PORT`

   Collect all in-use ports and simulators.

6. **Allocate resources**: Pick the first available from each pool that isn't already in use:
   - Pick first unused simulator from the list
   - Pick first unused EXPO_PORT
   - Pick first unused API PORT

7. **Create worktree** in `tmp/` folder:
   ```bash
   git worktree add -b "$BRANCH_NAME" "tmp/${BRANCH_NAME//\//-}"
   ```

8. **Copy .env files**:
   ```bash
   cp apps/api/.env "tmp/${BRANCH_NAME//\//-}/apps/api/.env"
   cp apps/mobile/.env "tmp/${BRANCH_NAME//\//-}/apps/mobile/.env"
   ```

9. **Configure worktree-specific settings**: Update the copied `.env` files with allocated resources:

   For `apps/api/.env` - update the PORT:
   ```bash
   sed -i '' "s/^PORT=.*/PORT=$ALLOCATED_API_PORT/" "tmp/${BRANCH_NAME//\//-}/apps/api/.env"
   ```

   For `apps/mobile/.env` - update API URL and append simulator/port settings:
   ```bash
   # Update the API URL to use the allocated API port
   sed -i '' "s|EXPO_PUBLIC_API_URL=http://localhost:[0-9]*|EXPO_PUBLIC_API_URL=http://localhost:$ALLOCATED_API_PORT|" "tmp/${BRANCH_NAME//\//-}/apps/mobile/.env"

   # Append worktree-specific settings
   cat >> "tmp/${BRANCH_NAME//\//-}/apps/mobile/.env" << EOF

# Worktree-specific settings
IOS_SIMULATOR=$ALLOCATED_SIMULATOR
EXPO_PORT=$ALLOCATED_EXPO_PORT
EOF
   ```

10. **Install deps**: `pnpm install` in new worktree

11. **If Supabase branch requested**:
    ```bash
    supabase link --project-ref wxszqhuhkeuspizwaarc
    supabase branches create "$BRANCH_NAME"
    ```
    Parse the output to extract the new database URL and keys, then edit:
    - `apps/api/.env`: Update `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
    - `apps/mobile/.env`: Update `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

12. **Show summary**: worktree path, branch name, allocated resources, next steps

## Cleanup reminder

```bash
git worktree remove tmp/<branch-name>
supabase branches delete <branch-name>  # if branch db was created
```
