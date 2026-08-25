---
name: merge
description: Land a PR and prove nothing was left open — gate it, merge from inside its worktree so the reap hook fires, watch the production migration deploy, close the Linear issue, then verify each of those actually happened. Use when the user runs /merge or /merge 54, or asks to merge, land or ship the PR they have been working on.
argument-hint: "[PR number]"
---

# /merge — land the PR, then prove the work is actually closed

The merge is one command. Everything that gets forgotten happens after it: a
simulator still booted, a branch database still billing, a production migration
that never deployed, a Linear issue still reading In Progress.

**This skill ends at a verified closed list, not at a successful merge.** A merge
that returned zero proves nothing on its own.

## Ground rules

- **The session itself must be in the worktree — a `cd` is not enough.** A
  `PostToolUse` hook on `gh pr merge` (`.claude/settings.json` →
  `scripts/worktree-reap.sh`) does the reclaim, and it reads `.cwd` from the
  **tool payload**, which is the session's working directory. A `cd <worktree>
  && gh pr merge` still reports the session's directory, so the hook sees the
  main checkout, takes its `[ "$here" != "$primary" ] || exit 0` branch, and
  says nothing at all. The worktree, its simulator and its branch DB all
  survive, and the only sign is `pnpm wt:list` flagging the branch MERGED later.
  So `EnterWorktree` before merging, or hand the merge to the session that owns
  the worktree.
- **Then leave, because the merge deletes the directory you are standing in.**
  That is the hook working, not a fault — but a session still pinned inside the
  worktree loses its workspace at the moment it succeeds, and everything from
  Phase 4 on lives in the main checkout: the CI watch,
  `tmp/autopilot-run.json`, the next `pnpm wt:new`. `ExitWorktree` the moment
  the merge returns. A loop that merges from inside and stays there ends its own
  run on a green merge.
- **A browser merge skips the hook entirely.** It only fires on the Bash tool
  call. When you arrive at a PR that is already `MERGED`, skip Phase 3 and do the
  reclaim by hand (Phase 6 covers it).
- **`master` has no branch protection.** `gh pr merge` will cheerfully merge a
  red or entirely unchecked commit. Phase 2 is the only thing standing in front
  of that, so no row in it is advisory.
- **The gate runs before the merge, not after.** Half of what makes the reclaim
  fail — a dirty tree, an unpushed commit — is free to see beforehand and
  annoying to unpick afterwards.
- **Never push migrations to production by hand.** The `deploy` job owns that,
  and it runs *after* the merge.
- **Quality passes are a separate errand.** `/simplify` and `/code-review` are
  their own skills, run while the branch is still being worked on. This one lands
  what is there.
- **Narrate each phase in one line:**
  `[#54 · gate] CI green · tree clean · See it working present · HAB-73 In Progress`

## Phase 1 — Identify what is being merged

1. **With an argument**: `gh pr view <n> --json number,title,state,headRefName,body,url`.
   **Without one**: the same call with no number resolves the PR for the current
   branch. If neither works, ask — never guess from `pnpm wt:list`.
2. Derive the issue from the branch name (`fix/hab-73-...` → `HAB-73`), then
   `mcp__linear__get_issue` to confirm it exists and read its current status.
3. Locate the worktree: `pnpm wt:list`, matching on branch. Read its
   `.env.worktree` for `WT_DB_MODE` — a `branch` DB is the piece that costs money
   if the reclaim silently fails.
4. Report in one line: PR, branch, worktree path, DB mode, issue and its status.
   This is the cheap moment to catch "wrong PR".

## Phase 2 — The gate

Every row is a stop, not a warning. Report the whole table, then stop on the
first failure and say what would fix it.

| Check | How | Stop when |
| --- | --- | --- |
| PR is open and mergeable | `gh pr view --json state,isDraft,mergeable,mergeStateStatus` | draft, `CONFLICTING`, or already `MERGED` (→ Phase 6 instead) |
| Every check passed | `gh pr view --json statusCheckRollup` | anything not `SUCCESS`, including still-running. Pending is a wait, not a pass. Confirm the rollup is the run for *your* head SHA (`gh pr view --json headRefOid`) and not a previous one |
| Nothing uncommitted | `git status --short` in the worktree | any output — `wt:rm` refuses a dirty tree, so the reclaim would fail *after* the merge |
| Nothing unpushed | `git log @{u}.. --oneline` | any commit — you are about to merge without your last change |
| Proof present | the PR body from Phase 1 | `## See it working` missing on a user-visible change (AGENTS.md requires it). Say so; the user decides whether to add it or wave it through |
| Issue is real and open | Phase 1's `get_issue` | already `Done` (someone closed it early — confirm this is the right issue) |

## Phase 3 — Merge

From **inside the worktree**:

```bash
gh pr merge <n> --squash
```

`--squash` because history here is one commit per PR. It is also what makes a bad
merge revertible with a single `git revert`.

**No `--delete-branch`, and that is not a style preference.** The flag ends by
running `git checkout master` so it can delete the local branch, which a worktree
can never do: `master` is checked out in the main checkout. So it fails *after*
the merge has already landed, `gh` exits non-zero, and the reap hook never fires.
`wt:rm` deletes the local branch as part of the reclaim anyway.

The remote branch is a loose end here: this repo has `deleteBranchOnMerge` off,
so GitHub keeps it. Delete it in Phase 6 with `git push origin --delete <branch>`,
or ask the user to turn the setting on once and stop thinking about it.

Then **read the hook's message before doing anything else.** It reports one of:

- reclaimed the worktree, simulator and branch DB, and that it pulled `master`;
- kept the worktree because the PR is not `MERGED`;
- could not reclaim, with `wt:rm`'s reason (a dirty tree, most often).

The last two are yours to finish. The hook never retries itself.

Then `ExitWorktree` — before Phase 4 and before anything else. The directory has
just been deleted underneath you: a session still sitting there has no
repository, and `git -C` cannot reach the main checkout from a session pinned to
it. Every remaining phase runs in the main checkout.

## Phase 4 — Watch what the merge started

Merging pushes to `master`, which starts CI again. When the PR touched
`supabase/migrations/`, the `deploy` job pushes those migrations to the
production project after the tests pass.

**This is the only step whose failure is both silent and expensive**: production
schema drifts from `master`, and the next thing to notice is a feature failing on
the real app. Nothing else in the flow watches it.

```bash
gh run list --branch master --limit 1     # find the run the merge created
gh run watch <id> --exit-status           # or poll if you would rather not block
```

Report the verdict. A failed `deploy` is not "the merge worked, but" — it is an
open incident, and it goes at the top of the Phase 6 report.

If the PR touched no migrations, say so and skip: `deploy` is a no-op and waiting
on it is dead time. A red run on `master` is still an incident even then, so read
the conclusion regardless.

## Phase 5 — Close the Linear issue

`mcp__linear__save_issue` with state **Done**
(`43fe685f-f2ab-4a9b-af82-2e7ce3861bb0`). Re-resolve with `list_issue_statuses`
on team **Habitron** rather than trusting that id if the call fails.

Do this **after** Phase 4, not before. An issue marked Done while its migration
failed to deploy is a false record, and the board is the thing you will trust
later.

## Phase 6 — Prove it

Print the closing list, each line carrying its evidence. Anything you could not
check is listed as **not verified** — never assumed.

| Closed | Evidence |
| --- | --- |
| PR merged | `gh pr view <n> --json state` |
| Remote branch gone | `git ls-remote --heads origin <branch>` returns nothing |
| Worktree, simulator, branch DB reclaimed | `pnpm wt:list` no longer lists the branch |
| `master` has the squash commit | `git log --oneline -1` from the main checkout |
| CI on `master` green, `deploy` included | Phase 4's run |
| Issue is Done | Phase 5's response |

Two follow-ups belong here and nowhere else:

- **A refused reclaim.** Fix the reason (usually commit or stash), then
  `pnpm wt:rm <branch>` from the main checkout. A `branch`-mode DB bills until
  that runs.
- **Other worktrees flagged `MERGED`.** Report them, do not reclaim them. They
  belong to other sessions that may still be working, and touching another
  worktree's simulator or branch database is the one rule the whole `wt:*` family
  is built on. Ask first, every time.

## When something goes wrong

| Symptom | What it means | Do this |
| --- | --- | --- |
| CI is green but for an older SHA | the rollup was read before the newest run registered | re-read `statusCheckRollup` and match it against `gh pr view --json headRefOid`. Pending is a wait, not a pass |
| Hook said nothing at all | the session was not *in* the worktree (a `cd` in the command does not count — the hook reads the session's cwd), or `gh` exited non-zero *after* merging | check `gh pr view <n> --json state` first: `MERGED` means the merge landed and only the cleanup failed. Reclaim by hand: `pnpm wt:rm <branch>` from the main checkout |
| `fatal: 'master' is already used by worktree at …` | `--delete-branch` slipped back into the merge command | the merge itself landed. Reclaim by hand, and drop the flag — Phase 3 says why |
| "Worktree kept: the PR for '<branch>' is OPEN" | `gh pr merge <n>` merged a *different* PR than this worktree's branch | merge this branch's PR from this worktree, or reclaim by hand |
| "Could not reclaim … Uncommitted work" | uncommitted work in the worktree | commit or stash it, then `pnpm wt:rm <branch>` |
| PR already `MERGED` on arrival | merged in the browser, so no hook fired | skip Phase 3; run Phases 4 to 6, reclaiming by hand |
| `fatal: not a git repository` right after the merge | the session was pinned inside the worktree the hook just deleted | the merge landed. `gh` still works with an explicit `-R devincimaker/habitron`, which needs no repository — confirm the state that way, then return to the main checkout and finish Phases 4 to 6 from there |
| `deploy` job failed | migrations did not reach production | read the run log; fix forward with a new migration. Never `db push` to production by hand |
| Anything database-shaped, or a `wt:*` refusal | a guard fired | invoke the **`wt`** skill; it has every refusal and its remedy. Do not work around one |
