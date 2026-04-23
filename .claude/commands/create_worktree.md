---
description: Create a new git worktree with branch, copy .env files, and optionally set up Supabase branch database
allowed-args: Linear ticket ID (e.g., HAB-45) to fetch issue details and auto-generate branch name
---

# Create Worktree

Create a new git worktree for isolated feature development.

## Arguments

This command accepts an optional argument: `$ARGUMENTS`

If the argument is a Linear ticket ID (e.g., `HAB-45`), fetch the issue details and use them to auto-generate the branch name.

## Source Of Truth

Do not reimplement port or simulator allocation in this command. Use the executable repo command:

```bash
pnpm worktree:create -- "$BRANCH_NAME"
```

If a custom directory name is needed:

```bash
pnpm worktree:create -- "$BRANCH_NAME" "$WORKTREE_NAME"
```

By default, new branches start from the caller's current `HEAD`. To force a different base:

```bash
pnpm worktree:create -- --base origin/master "$BRANCH_NAME"
```

The allocator logic lives in:
- `scripts/create-worktree.sh`
- `scripts/setup-worktree.sh`

## Steps

1. **Check for Linear ticket argument**: If `$ARGUMENTS` contains a Linear ticket ID (pattern: `HAB-\d+`):
   - Use `mcp__linear-server__get_issue` to fetch the issue details
   - Extract the issue title and use it for the branch name
   - Infer work type from Linear labels if available (e.g., "bug" → fix, "enhancement" → feature), otherwise default to "feature"
   - Skip to step 4

2. **Ask for source** (if no argument provided): How do you want to name this branch?
   - **Linear ticket**: Enter a ticket ID to fetch details (e.g., HAB-45)
   - **Description**: Enter a brief description manually

   If Linear ticket selected:
   - Ask for the ticket ID
   - Fetch issue details using `mcp__linear-server__get_issue`
   - Extract title and infer work type from labels
   - Skip to step 4

3. **If description selected**:
   - Ask the work type: What kind of work? (feature, fix, refactor, chore)
   - Ask for description: Brief description of what to implement (e.g., "mini-calendar", "user settings page")

4. **Generate branch name**:
   - If from Linear: `{inferred-type}/{ticket-id}-{title-kebab-case}` (e.g., `feature/HAB-45-add-habit-streaks`)
   - If from description: `{type}/{description-kebab-case}` (e.g., `feature/mini-calendar`)

5. **Ask about Supabase**: Do they want a branch database? (Yes/No)

6. **Create the worktree using the repo command**:
   ```bash
   pnpm worktree:create -- "$BRANCH_NAME"
   ```
   If a custom directory name is needed, pass it as the second argument.

7. **If Supabase branch requested**:
   ```bash
   supabase link --project-ref wxszqhuhkeuspizwaarc
   supabase branches create "$BRANCH_NAME"
   ```
   Parse the output to extract the new database URL and keys, then edit:
   - `apps/api/.env`: Update `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - `apps/mobile/.env`: Update `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

8. **If Linear ticket was used**: Update the issue state to "In Progress" using `mcp__linear-server__update_issue`

9. **Show summary**: worktree path, branch name, allocated resources, Linear ticket (if used), next steps

## Cleanup reminder

```bash
scripts/teardown-worktree.sh
git -C <main-repo-path> worktree remove <worktree-path>
supabase branches delete <branch-name>  # if branch db was created
```
