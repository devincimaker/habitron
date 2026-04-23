---
description: Remove the current git worktree, its branch, and optionally its Supabase branch database
---

# Cleanup Worktree

Remove the current worktree and associated resources.

## Steps

1. **Detect current worktree**: Resolve the main checkout via git metadata and compare it to the current directory:
   ```bash
   CURRENT_WORKTREE=$(git rev-parse --show-toplevel)
   CURRENT_WORKTREE=$(cd "$CURRENT_WORKTREE" && pwd -P)
   GIT_COMMON_DIR=$(git rev-parse --git-common-dir)
   GIT_COMMON_DIR=$(cd "$GIT_COMMON_DIR" && pwd -P)
   MAIN_REPO=$(dirname "$GIT_COMMON_DIR")
   ```
   If `CURRENT_WORKTREE` equals `MAIN_REPO`, error out with "Not in a worktree".

2. **Get branch name**:
   ```bash
   git branch --show-current
   ```

3. **Check for Supabase branch**: Read `apps/mobile/.env` and check if `EXPO_PUBLIC_SUPABASE_URL` contains a branch database URL (not the main database).

4. **Confirm deletion**: Show what will be deleted and ask for confirmation.

5. **Tear down allocated resources**:
   ```bash
   "$CURRENT_WORKTREE/scripts/teardown-worktree.sh"
   ```

6. **Remove the worktree**:
   ```bash
   git -C "$MAIN_REPO" worktree remove "$CURRENT_WORKTREE" --force
   ```

7. **Delete the git branch**:
   ```bash
   git -C "$MAIN_REPO" branch -D <branch-name>
   ```

8. **Delete Supabase branch** (if detected in step 3):
   ```bash
   supabase branches delete <branch-name>
   ```

9. **Show summary**: Confirm what was cleaned up.
