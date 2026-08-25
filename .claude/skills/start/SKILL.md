---
name: start
description: Start work on a Linear issue — mark it In Progress, create and initialize the right worktree (shared vs --db, simulator only when the issue is user-visible), enter it, then plan the change together before any code is written. Use when the user runs /start HAB-XX, or asks to start working on an issue or open a PR for one.
argument-hint: HAB-XX
---

# /start — Linear issue to a worktree you're already inside, then a plan

The boring parts happen before the conversation does. By the time you and the
user are discussing what to build, the issue is In Progress, the worktree exists
with the right database, and this session is inside it.

**This skill ends at an agreed plan.** You then implement in normal
conversation, with the user reviewing as you go.

## Ground rules

- **Setup runs first, and you do not ask permission for it.** Reading the issue,
  moving it to In Progress and creating the worktree are the reason the skill
  was invoked, not decisions to confirm. Never open with "shall I create the
  worktree?".
- **No feature code before the plan is agreed.** Reading code while planning is
  the job; editing it is not.
- **Plan mode active at invocation?** Setup writes to Linear and to disk, so it
  is blocked. Say so in one line and ask the user to leave plan mode. Do not
  skip setup and plan against a worktree that does not exist.
- **Narrate each step in one line**, so the routing decisions stay visible and
  easy to challenge:
  `[HAB-73 · setup] feat/hab-73-optional-times · --db (new column) · no simulator (nothing on screen)`
- The slow step is `--db` provisioning (minutes). Fire it, then read code while
  it runs. Overlapping the wait with the research is the point of doing setup
  first.

## Phase 1 — The issue

1. `mcp__linear__get_issue` on the identifier. Never route from the issue number
   alone.
2. Move it to **In Progress** (`save_issue`, state id
   `50df3fb4-1360-4f1c-9134-530709806d5d`). Re-resolve with
   `list_issue_statuses` on team **Habitron** rather than trusting that id if
   the call fails. Do this **before** the slow steps, so the board is honest the
   moment work starts.
3. Print a 3 to 5 line brief: title, labels and size, what the issue says is
   broken, what it suggests. This is the last cheap moment to catch "wrong
   issue".

## Phase 2 — Route: two independent calls, each logged with its reason

**The `wt` skill owns both decisions** — read its *Routing* section and follow
it. Database and simulator are decided there, in one place, so this skill and
`autopilot` cannot drift into routing the same issue differently.

Log the outcome in one line before Phase 3 runs, so the calls stay visible and
easy to challenge:

```
[HAB-83 · setup] feat/hab-83-day-ratings · --db (new table) · no simulator (coach-only)
```

The one thing worth carrying in your head while you read it: the two calls are
not symmetric. Both are cheap to reverse, but **shared mode is the live
database**. A wrong `--db` wastes minutes and a few cents. A migration run in
shared mode is a production schema change nobody reviewed.

## Phase 3 — The worktree

1. **`pnpm wt:list` first.** If a worktree for this issue already exists, enter
   it and skip creation. Running `/start HAB-73` twice must resume, not fail. A
   worktree you did not create may belong to another session: ask before
   touching it.
2. From the main checkout: `pnpm wt:new feat|fix|chore|refactor/hab-NN-<slug> [--db] [--no-sim]`.
   Branch names follow the AGENTS.md convention, not Linear's `gitBranchName`.
   Use a **Bash timeout of 600000** when passing `--db` — provisioning takes
   minutes and a default timeout will kill it midway.
3. If setup dies partway it prints the exact retry (`pnpm wt:setup <path> [--db]`).
   Run that. **Do not delete the worktree and start over** — it may already own
   a billable branch database that only its ledger names.
4. **Enter it**: `EnterWorktree` with the path `pnpm wt:new` printed. If it
   refuses, stay in the main checkout and run every subsequent command with the
   worktree's absolute path as cwd.
5. Read `.env.worktree` and report the slot in one line: Expo port, API port,
   simulator name, DB mode, and which database is live. Never assume the main
   checkout's.

## Phase 4 — Run it, only if Phase 2 said so

`pnpm dev` boots this worktree's simulator, installs the prebuilt dev client if
the simulator is new, starts Metro on this worktree's port and the API on its
own, and deep-links the app to the right bundler. It is persistent: run it in
the background, or in a pane the user can see, and never block a turn on it.

**Never pipe it through `tail` or `head`.** They print nothing until EOF, and a
persistent process holds the pipe open, so the command looks hung when it has
been serving for a minute. Let it stream, or redirect to a file and read that.

**Confirm readiness with a probe, not with the command's exit.** Both of these
answer it outright:

```bash
lsof -ti :$WT_EXPO_PORT              # Metro is listening
xcrun simctl list devices booted     # and this worktree's simulator is up
```

Reading `ps` is unreliable here: every other worktree runs its own `expo start`,
so a match proves someone's Metro is alive, not yours. Match on the port.

**To reach a screen, deep-link to it.** The app's scheme is `habits-coach`, and
expo-router maps routes straight onto it:

```bash
xcrun simctl openurl "$WT_SIM_UDID" "habits-coach://today"
```

Chains of blind taps drift, and a fast refresh resets navigation underneath you,
so a chain that worked once fails silently the next time.

**Let the tests carry the numbers.** The simulator answers "does this look
broken", which is one screenshot. It is a slow and imprecise way to assert a
value a unit test can pin exactly.

## Phase 5 — Plan it together

This is what the skill is actually for. The setup was clearing the runway.

**First, check whether there is anything left to plan.** When the issue already
names the change and the label is `S` or `XS`, the plan has been written by
whoever filed it. Read the code, do it, and report what you found and what you
decided in the summary afterwards. Planning it a second time is the expensive
way to agree with the issue.

So: **plan when the issue leaves the approach open, implement when it does not.**
The rest of this phase is for the first case.

1. **Read the code the issue names before proposing anything**, and report which
   of the issue's claims the code confirms and which it does not.
2. **Present, in this order:** what you found → the levers available → a
   recommended approach → the open questions. Two rules govern the levers:
   - **Copy and content are levers, not fixed constraints.** Pick the cheapest
     lever that solves the *class* of problem, and say why you rejected the
     cheaper ones. Propose exact wording, never a vague "shorten it", and flag
     user-facing copy changes as needing sign-off.
   - **Match the size of the fix to the size of the issue.** A new shared
     component, a new prop on a shared primitive, or a refactor of adjacent code
     is rarely warranted by an `S` bug. If you believe it is, justify it and
     expect to be challenged.
3. **`AskUserQuestion` only when a wrong guess costs more than asking.** The test
   is whether being wrong would throw away work already done, not whether the
   choice is interesting. A decision you can state in the summary and reverse in
   one edit is one you should just take.
4. **How formal to be is a judgment call — state it out loud.** Default to a
   conversation. Call `EnterPlanMode` when the change is big enough that a
   written plan is worth reviewing, or whenever the user asks.
5. **Close by naming what comes next**, briefly: the gate
   (`pnpm turbo typecheck lint test`), the `## See it working` section every
   user-visible PR needs, and that the merge hook reclaims this worktree
   automatically once the PR is merged.

## When something goes wrong

| Symptom | What it means | Do this |
| --- | --- | --- |
| `Branch already checked out` | someone is already on it | `pnpm wt:list`, enter that worktree instead of creating one |
| `Worktree path already exists` | a previous run got that far | enter it; re-run `pnpm wt:setup <path> [--db]` if it looks half-built |
| "worktree was created but setup did not finish" | setup died mid-run | run the retry line it printed; the worktree is fine |
| `EnterWorktree` refuses the path | not a first entry, or not in `git worktree list` | stay in the main checkout; pass the worktree's absolute path as cwd on every command |
| `Configured simulator "…" was not found` | the ledger names a simulator nobody created | `pnpm wt:setup --sim` |
| "This worktree was set up with --no-sim" | Phase 2 routed it as invisible and the diff proved otherwise | `pnpm wt:setup --sim` |
| Issue is already In Progress | another session may own it | check `pnpm wt:list` for its worktree and ask the user before starting a second one |
| Anything database-shaped, or a `wt:*` refusal | a guard fired | invoke the **`wt`** skill; it has every refusal and its remedy. Do not work around one |
