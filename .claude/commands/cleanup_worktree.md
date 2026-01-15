---
description: Remove the current git worktree, its branch, and optionally its Supabase branch database
---

# Cleanup Worktree

Remove the current worktree and associated resources.

## Steps

1. **Detect current worktree**: Check if the current working directory is inside a `tmp/` worktree. If not, error out with "Not in a worktree".

2. **Get branch name**:
   ```bash
   git branch --show-current
   ```

3. **Check for Supabase branch**: Read `apps/mobile/.env` and check if `EXPO_PUBLIC_SUPABASE_URL` contains a branch database URL (not the main database).

4. **Confirm deletion**: Show what will be deleted and ask for confirmation.

5. **Change to main project**:
   ```bash
   cd /Users/devinci/Solopreneur/habitron
   ```

6. **Remove the worktree**:
   ```bash
   git worktree remove "tmp/<worktree-name>" --force
   ```

7. **Delete the git branch**:
   ```bash
   git branch -D <branch-name>
   ```

8. **Delete Supabase branch** (if detected in step 3):
   ```bash
   supabase branches delete <branch-name>
   ```

9. **Show summary**: Confirm what was cleaned up.
