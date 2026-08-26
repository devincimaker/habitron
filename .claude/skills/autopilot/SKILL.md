---
name: autopilot
description: Drain Linear's Ready state without supervision — one looped agent takes the smallest unblocked issue from spec to merged master or a parked PR, tick after tick, while the user keeps speccing issues into Ready. Use when the user runs /autopilot, /autopilot sweep to file candidates, /autopilot ready 88 83 to spec-check and promote issues, or /loop /autopilot to run continuously.
argument-hint: "[sweep | ready <numbers> [--next] | next <number> | status | stop]"
---

# /autopilot — one Ready issue, landed, then stop

The queue is a Linear state. **Ready** holds work the user has planned and
approved for unattended execution; moving an issue into Ready *is* the approval.
The user's half of the loop is keeping that state filled. This skill is the
other half: pick the smallest unblocked Ready issue, build it, prove it, review
it, merge it, record it, stop. `/loop /autopilot` keeps one agent draining the
state for as long as the user keeps feeding it.

**Every invocation ends at a merged commit, a parked PR, a recorded refusal, or
a quiet idle tick when nothing is Ready.** Never at a half-built worktree, and
never at two issues in one PR.

## This app has one user, and it is the author

That fact sets the dial. There are no external consumers, no old clients, no API
contracts (AGENTS.md §1). A change that turns out wrong breaks it for one
person, who can revert it. So this loop is deliberately more permissive than the
same skill in a repo with a userbase: it takes bigger work, it writes schema, it
redoes whole screens, and it merges itself rather than parking for taste.

What it does **not** loosen is the machinery that makes "I'll just fix it" true.
Those guards are not about risk to users; they are about the loop staying honest
with itself, and every one of them is load-bearing:

- **One issue, one PR, one squash commit.** `git revert <sha>` is the entire
  recovery plan and it only works if ticks stay atomic.
- **The gate, and CI green on the actual head SHA before merging.** `master` has
  no branch protection, so `gh pr merge` will merge a red or unchecked commit.
  Merging red means the next tick starts from a broken tree.
- **Merge from inside the worktree**, so the reap hook fires. Ten ticks that
  skip it leave ten worktrees and possibly ten billable branch databases.
- **Scope discipline.** A tick does not fix the interesting thing next door. Not
  about risk — about the revert staying meaningful.

The test for a new guard, when one is tempting: does it protect the revert, the
gate, or the honesty of a claim? Then it belongs. Does it forbid a *technique*
because the technique could be done carelessly? Then it does not — require the
proof instead and let the tick work. A loop allowed to touch only what is
trivially safe runs out of useful work long before the queue does, and an
over-broad refusal ends a run exactly as dead as a bad merge does.

## Ground rules

- **Ready is the mandate.** Work only on issues in `Ready`. Never invent a
  target, never widen one. If a tick finds something real and out of scope, file
  it in `Backlog`, `add filed`, and carry on.
- **Destructive migrations park; additive ones ride free.** A revert does not
  bring data back. `DROP COLUMN` on a populated column, a type narrowing, a
  delete-and-recreate, a backfill that overwrites: build it, open the PR, and
  leave the merge to the user. Adding tables, columns, indexes, policies, RPCs
  is ordinary tick work. Two facts every schema tick carries: merged migrations
  are immutable (fix forward, never edit), and **merging deploys migrations to
  the production project** (AGENTS.md §6).
- **Refusing is a completed tick, not the end of the run.** Comment the reason,
  route the issue, reclaim the worktree, take the next one. Three consecutive
  refusals *do* end the run — that means the queue has stopped producing work
  the loop can safely do, and the user needs to see that rather than have it
  worked around.
- **An empty Ready state idles, it does not stop.** Schedule a quiet wake-up and
  look again; the user may be speccing the next issue right now.
- **Merge by default, park by exception.** A tick merges itself when the gate is
  green and the review pass is clean or its confirmed findings were fixed in
  scope. It parks only when it is genuinely stuck, when a confirmed finding
  *in this diff* cannot be fixed inside scope, when the migration is
  destructive, or when the issue carries a `park` tag.
- **Spend nothing on a reader who is not there.** A tick that merges itself is
  read by nobody. Proof that catches a regression stays, always. Proof shaped
  for a human — a before/after pair, a recap page — happens only where review
  actually happens: a park, a refusal, the run report.
- **Narrate each phase in one line**, so an unattended run reads back cleanly:
  `[HAB-88 · class B · tick 3] composer clears on echo · jest + one sim shot`

## The run state

- **Linear is the queue, whole and only.** No project, no queue file: the state
  machine is the run.
  - `Backlog` / `Todo` — the user's spec pipeline. Not yours to take.
  - `Ready` — approved. Yours.
  - `In Progress` — this tick, exactly one issue at a time.
  - `In Review` — parked: PR open, waiting on the user.
  - `Done` — merged. `Canceled` — dead.
  - A refusal that better speccing could save goes **back to `Todo`** with the
    reason in a comment — that is the hand-off to the user's pipeline.
  - **Chains are Linear "blocked by" relations**, declared at promotion time. A
    Ready issue blocked by anything not `Done` is skipped, not taken.
### The run ledger

**`tmp/autopilot/<run>/` is the run ledger** — one directory per run, in the
main checkout, gitignored. `run.json` is the structured truth; `report.md` is
rendered from it after every write, and it is the page the user reads the
morning after, sections in the order they act on them: what needs their
decision, what landed and where to look for it in the app, what was filed for
them, what the bot decided on its own, then the tick log. Linear survives
anything; the ledger keeps the loop honest across compactions and is all the
user ever sees of an unattended run.

`scripts/autopilot-run.mjs` is the only way to touch it. It runs from anywhere
in the repo and finds the main checkout's `tmp/` on its own:

```
node scripts/autopilot-run.mjs tick                       # Phase 1: open or continue this session's run
node scripts/autopilot-run.mjs add landed   '{"issue","class","pr","title","proof","seeIt"}'
node scripts/autopilot-run.mjs add parked   '{"issue","class","pr","title","blockedOn","decide","resume"}'
node scripts/autopilot-run.mjs add refused  '{"issue","class","why","routedTo"}'   # Todo | Canceled
node scripts/autopilot-run.mjs add filed    '{"issue","title","why","during"}'
node scripts/autopilot-run.mjs add decision '{"issue","note"}'
node scripts/autopilot-run.mjs add log      '[HAB-88 · B · tick 3] merged #71 · …'
node scripts/autopilot-run.mjs add idle     'nothing Ready · 2 blocked behind HAB-111'
node scripts/autopilot-run.mjs close        'stopped'   # or 'halted: <why>'
node scripts/autopilot-run.mjs status
```

**A run is one Claude Code session.** `tick` reads `CLAUDE_CODE_SESSION_ID`: the
same session (a `--resume` included) continues its run; any other session
closes the newest open run retroactively as `session ended` at its last tick,
then opens a new one. That is the only boundary. A run that was killed, slept
or crashed is closed by the next run's first tick, and its report says when it
last moved. Idle never closes a run. `add` refuses on a closed run and refuses
an entry with a field missing, so the report never has a hole where a decision
should be. The counter behind the three-refusals stop lives here too: `refused`
increments it, `landed` and `parked` reset it. If `run.json` carries a `cap`,
honour it (a bounded overnight run); by default there is none, because the user
meters the run by what they promote.

Write entries for a reader who was not there. `seeIt` is the deep link or the
taps that put the change on screen — the user walks the app with the report
open; A and C carry none, and the report prints `nothing on screen`. A park's
`blockedOn`, `decide` and `resume` are one line each: what stopped it, the
choice being asked, and the command that lands it (`/merge NN` from
`<worktree>`). A `decision` is any call the tick made that the user did not —
a premise corrected, a review finding filed instead of fixed, a checklist row
ticked as stale, an issue closed because its premise was gone.

## The four classes of work

Each queued issue carries its class in the title prefix. The class decides the
proof, and the proof is the whole reason the work is safe to leave alone. Sizing
follows AGENTS.md §9 — the proof matches the change, nothing more.

| Class | The change | The proof |
| --- | --- | --- |
| **A · swap** | a hardcoded literal replaced by the token that already holds *exactly* that value | the diff. Pixel-identical by construction |
| **B · fix** | a bug with a named cause and a named fix | a test that fails before and passes after — or, when it only exists on screen, one simulator pass and one screenshot |
| **C · extract** | logic lifted out of a component into `packages/shared`, `apps/mobile/utils/`, or `packages/habitron`, with unit tests | the tests, named in the PR |
| **D · slice** | a real feature slice: several files, may add UI, may carry schema | whatever the issue's own proof section names |

### Class A — swap

Replace a literal **only when it equals a token's value exactly**.
`borderRadius: 9999` → `BORDER_RADIUS.full`. `padding: 24` → `SPACING.lg`. The
scale lives in `apps/mobile/constants/theme.ts`.

Never round in class A. `borderRadius: 12` is not `BORDER_RADIUS.lg` (16), it is
a class B candidate or nothing.

**A value with no token, used five times or more, is a design decision, not a
chore.** File it as an issue describing the options and move on. Do not pick one.

### Class B — fix

The bread and butter here, because this is a working app with real bugs. A
class B issue names the cause with a file and line, names the fix, and names how
it is proved. HAB-88 is the shape: *this line awaits something that resolves too
late, clear it on echo instead, prove it with a send.*

Visual work rides in class B too, and it is not capped: a tick may redo a whole
screen's spacing, colour or layout when the issue says so. A bad visual change
is one `git revert`. What it may not do is decide the design — a change the
issue did not describe is out of scope, however obvious it looks on screen.

**Any screen the app can reach, a tick can reach.** Prefer a deep link where one
exists (`habits-coach://tasks`, `habits-coach://session?autoPrompt=review-day`,
…) — it is faster and one fewer thing to assert. Where none does, navigate: tap
by accessibility label, one step at a time, reading the screen back after each.
What a tick may never do is *claim* a screen it did not confirm it was on. Phase
5 says what confirming means.

### Class C — extract

One function, one purpose. Logic a jest or vitest test can only reach by
standing up the world moves into `packages/shared`, `apps/mobile/utils/`, or
`packages/habitron`, and gets thorough unit tests — happy path, edges, failure
modes. No behaviour change. If the extraction reveals a bug, **do not fix it
here**: land the extraction with a test pinning current behaviour, and file the
bug.

### Class D — slice

Decently sized work rides the same loop. There is no template to fill in; the
issue itself is the spec, and it qualifies when it carries three things:

1. **What to change**, with the paths — enough that a tick needs nothing from
   the conversation that produced it.
2. **How it is proved**, per §9 sizing.
3. **What it must not touch** — the non-goals that keep one tick from becoming
   three.

A schema section is required only when the work carries schema: name the
migration, the RLS/RPC surface, and the tests. HAB-83's "Sequencing" section is
the model — each stage is one class D tick.

An issue missing any of the three is rejected at promotion (`/autopilot ready`),
not burned as a mid-run refusal.

Budget honestly: A–C ticks run 15–30 minutes; a D tick is plausibly one to two
hours. Promote with the clock in mind, not just the count.

### Checklist issues — one issue, many ticks

Some work is a long list of identical, independent changes: twenty files over a
line cap, forty call sites to migrate. Filing one issue per row buries the queue
in near-duplicates; putting them all in one PR destroys the atomic revert.

So an issue may declare itself a **checklist issue**, saying so near the top and
carrying a `- [ ]` list. A tick then:

1. takes the **top unchecked row**, not the whole issue;
2. does that row and nothing else — one row, one PR, one squash commit;
3. ticks the row in the issue body (`save_issue` with a `patch`) as part of the
   same tick;
4. leaves the issue **In Progress**, and stops.

The issue closes when the last row is ticked. Phase 1 may take a checklist
issue that is already In Progress — it is the one case where In Progress is not
another session's claim, because the rows are independent. Phase 8 records the
row, not the issue: `[HAB-89 · C · tick 4] merged #74 · split TaskCalendar.tsx · 18 rows left`.

Rows can go stale: an earlier row may have moved shared code, so re-measure
before starting one. A row whose premise is gone is ticked with a note, not
built (Phase 3's rule, per row).

### The coach lane — a proof rule, not a class

Any class may touch `packages/coach-skills` or the tool surface in
`packages/habitron`. When it does, the proof grows one item: vitest for the
tools, and **`pnpm --filter @habits-coach/api coach:smoke "<prompt>"`** for the
skills, with the prompt and the relevant part of the turn quoted in the PR. A
skill file is prose the coach acts on; a diff alone does not prove it still
behaves.

## Phase 1 — Pick up the run

1. `node scripts/autopilot-run.mjs tick`. It says whether it opened a run,
   continued this session's, or closed a previous session's first, and prints
   the tick number, `consecutiveRefusals`, `cap` and the landed count.
2. **Stop now, before any setup, if** `consecutiveRefusals >= 3`, or `cap` is
   set and the landed count has reached it: `close 'halted: <which>'`, hand
   back the report (Phase 8) and call `ScheduleWakeup` with `stop: true`.
3. `git -C <main checkout> pull` on `master`. Every tick starts from a master
   that already contains the previous tick's merge, which is why this loop never
   rebases and never conflicts with itself.
4. List team **Habitron**'s `Ready` issues and drop the blocked ones (any
   `blocked by` relation not `Done`). **None left?** That is an idle tick, not a
   stop: `add idle 'nothing Ready · N blocked behind <issue>'` (which logs the
   line and marks the run idle from this tick), narrate it, `ScheduleWakeup`
   with `noop: true` and 1200–1800s, and end the invocation.
5. Take the first unblocked issue in this order: **anything carrying the `next`
   label**, then class ascending A→D, then priority, then oldest. `next` is the
   user's pin — it exists so "do this one first" is a label and not a plea, and
   it outranks class because the user has already weighed the size. Two `next`
   issues fall back to the rest of the order. Remove the label when the issue
   leaves Ready (Phase 8), so it never lingers as a stale pin. Move the pick to
   **In Progress** (state id
   `50df3fb4-1360-4f1c-9134-530709806d5d`; re-resolve with
   `list_issue_statuses` if that fails). A **checklist issue** already In
   Progress is takeable and sorts by its top unchecked row.

## Phase 2 — Worktree

`pnpm wt:new [--db] [--no-sim] feat|fix|chore|refactor/hab-NN-<slug>` from the
main checkout. Branch names follow AGENTS.md §8, not Linear's `gitBranchName`.
Flags go **before** the branch: `wt:new` takes anything after it as the
worktree's directory name, so a trailing `--db` silently gives you a shared-mode
worktree pointed at production.

**The `wt` skill owns both routing calls** — read its *Routing* section and
follow it, the same one `/start` follows, so a tick never routes an issue
differently than you would have. Two things the class adds on top of it:

- The class already answers the simulator call: **A and C are always
  `--no-sim`**; B and D take one exactly when their proof is a screenshot
  rather than a test or a diff.
- An issue that leaves you guessing about schema is incomplete. Refuse it back
  to `Todo` (Phase 6) instead of picking — that guess is the one that runs a
  migration on production.

Bash timeout **600000** when passing `--db`. Then `EnterWorktree`.

`wt` also owns every refusal this can produce. A guard that fires is a refusal
(Phase 6), not something to route around. **Never delete a worktree to escape a
failed setup** — it may already own a billable branch database that only its
ledger names.

## Phase 3 — Read before writing

Open the files the issue names and confirm its claims. An issue specced last
week can be stale: the line may already have moved, the fix may already be in.

**If the issue's premise is gone, that is a success, not a failure.** Close it as
Done with a comment saying so, reclaim the worktree, `add decision` with what
was claimed and what was found, `add log` the tick, and let it count as neither
landed nor refused. Then stop; the next tick takes the next issue.

**A premise that is wrong but leaves real work is corrected, not obeyed.** Test
the issue's claims before building on them; when one falls, do what the corrected
premise implies and record the correction in the PR body, on the issue, and as
an `add decision` — what was claimed, what was found, how you know. The issue's
scope still bounds the work: a fallen premise never widens it.

## Phase 4 — Build it

Exactly what the issue says, at the class's rules. Then the gate, in the
worktree (AGENTS.md §9):

```bash
pnpm typecheck && pnpm lint && pnpm knip && pnpm test
```

A tick that touched `packages/coach-skills` or the `packages/habitron` tool
surface adds its coach-lane proof here.

A tick that touched `supabase/migrations/` applies the migration on **this
worktree's branch database** (`pnpm wt:db:reset`) and runs the gate against it.
A shared-mode worktree never applies a migration — that is production.

Two build rules the run's audit will hold a tick to:

- **No cast that erases inference** — `as any`, `as unknown as X`, or a
  `@ts-expect-error` silencing a type. If one is genuinely unavoidable, it
  appears in the PR body with its reason; an escape hatch nobody wrote down is
  how typed code quietly stops being typed.
- **A change to any pattern, filter, or matcher** (regex, glob, ignore list,
  lint selector) **is proved by its real set difference**, computed against the
  actual tree and pasted in the PR body — never by a representative example. The
  example you can imagine is not the file that breaks.

## Phase 5 — Prove it, by class

Capture what the tick needs to be safe and nothing past it. Two costs hide
inside "visual proof" and they are not the same size: booting a simulator and
driving it is the expensive one, and it earns its keep because it catches a
screen that renders blank whether or not anyone reads the result. Assembling
something for a person to look at is the cheap one, and it is worth nothing when
the tick then merges itself. Split them.

**A and C**: nothing to capture, and **no simulator**. The diff and the tests are
the proof.

**B and D, when the proof is a test**: the test, named, and its before/after
behaviour stated.

**B and D, when the proof is a screenshot**: `pnpm dev` in the foreground, never
piped through `tail`/`head`. Confirm readiness by probe (`lsof -ti
:$WT_EXPO_PORT`, `xcrun simctl list devices booted`), not by exit code. Apply the
change, wait for fast refresh, navigate to the screen, and screenshot **the
result**. One pass, one shot.

**A screenshot is proof only if the tick can name what it asserted about the
screen before taking it.** Get there however the screen is reachable — a deep
link when one exists, otherwise `sim.py tap "<label>"`, as many steps as it
takes. Before the shot counts, read the screen back (`sim.py ls`) and confirm an
element that appears **only** on the target screen; name that element in the PR
body beside the image. Reaching a screen is ordinary work. Claiming you reached
it is the part you earn.

The guard is deliberately about the claim and not the technique. A tap that
lands 20pt off, a modal that swallowed it, a list that scrolled — each of those
is invisible in the resulting image and obvious in the assertion. What to refuse
is a step that cannot be checked this way: nothing stably labelled to tap
toward, or nothing unique on the target screen to assert. Name which one on the
issue (Phase 6).

No stash, no before/after pair on a tick that merges itself. The shot proves the
screen still renders and the change landed where the issue said; the *comparison*
is for a human eye, and a self-merging tick has none. Name the trade rather than
hiding it: a merged visual change leaves no published picture of itself, and its
rollback is the `git revert` the squash guarantees. Parking turns the pair back
on (Phase 7).

The `simulator-driving` skill owns both the two blockers that trap an unattended
tick (the Expo dev-menu sheet, the SpringBoard "Open in Habits Coach?" alert)
and the label-tapping and screen-reading the rule above depends on — `simctl`
cannot tap, `idb` can, and `sim.py` knows an alert from a label. Invoke it
rather than improvising coordinates. A simulator still unresponsive after it has
had a go is a broken tool rather than hard navigation: refuse, and do not merge
a visual PR blind.

## Phase 6 — Refuse, when refusing is right

Refuse and move on, never soldier through, when:

- the issue needs schema it never named, or tests need a database it never
  planned for;
- a screen cannot be positively identified — nothing stably labelled to tap
  toward, or nothing unique on it to assert — or the simulator will not
  cooperate after `simulator-driving` has had a go;
- the honest fix is a design decision the issue did not make;
- the gate fails for a reason outside this issue (`master` was already red);
- the diff is drifting past the issue — two concerns, or a third file you did not
  expect.

To refuse: comment the reason on the issue, then route it — **back to `Todo`**
when a better spec could save it, or **Canceled** when the idea itself is dead.
`pnpm wt:rm <branch>` from the main checkout, `add refused` with the class, the
reason and where it went (the ledger counts the streak), `add log` the tick,
and **take the next issue**. Three in a row ends the run (Phase 1).

## Phase 7 — Simplify, PR, review, then merge

**Classes C and D take the `simplify` pass first**, while the diff is still
cheap: invoke the `simplify` skill starting from what this branch changed. It
edits code, so it runs before the PR exists and before the body is written; if it
changes anything, re-run the Phase 4 gate. A no-op pass is a good outcome, not a
wasted one. Classes A and B skip it — their diffs are mechanical or surgical by
construction.

```bash
gh pr create --title "<imperative>, matching the repo's convention (HAB-NN)" --body "..."
```

The body describes **this** PR and nothing after it (AGENTS.md §8): no
follow-ups, no "left alone", no future work. It ends with `## See it working`
(§10):

- **A**: the swap, and that it is value-identical — each literal and the token
  that already held it.
- **B**: the test and its before/after, or the route taken to the screen, the
  element asserted on it, the simulator, and what changed.
- **C**: the test file and the cases, named.
- **D**: the issue's proof section, delivered item by item. Schema ticks name the
  migration and the branch database it was applied on.
- **Coach lane**: the `coach:smoke` prompt and the part of the turn that proves
  the behaviour.

The body will be audited by fresh eyes, so write it to survive one: every count
comes from a command run in this session (recount, never remember), every named
file is one you verified exists, and a premise correction (Phase 3) states what
was claimed, what was found, and how you know.

**Then the review pass, before the merge.** Invoke the `code-review` skill on
this branch — **medium** for classes A–C, **high** for class D. An unattended
tick pays for a false positive twice, once investigating it and once parking a
chain over it, so confidence is worth more than breadth. Act only on findings the
review confirms:

- confirmed and inside the issue's scope: fix it now, re-run the gate, push, and
  let the merge wait on the new head's CI run;
- confirmed, but in code this PR did not touch: **file it in `Backlog`,
  `add filed`, and merge**. A finding next door does not make this diff wrong,
  and parking a correct PR over it stalls the queue for nothing;
- confirmed, inside this diff, and not fixable within the issue's scope:
  **park** — never widen the diff to chase it;
- unconfirmed: drop it.

Then invoke the **`merge`** skill with the PR number, **from inside the
worktree**. It owns the gate, the squash, the reap hook, and closing the issue.
Four things this loop depends on:

- it waits for a CI run **for the current head SHA** — the only thing standing in
  front of an unchecked merge;
- it merges with `--squash`, so the rollback is one `git revert`;
- it merges from the worktree, so the reap hook reclaims the worktree, the
  simulator and the branch database;
- for a schema tick, it **watches the production migration deploy** after the
  merge. That watch is part of the tick: a migration that deploys red is this
  tick's mess, found now while the context to fix forward is still loaded.

If `/merge` stops at its gate, that is a refusal: Phase 6, with its reason.

**To park instead of merging**: this is the one path that ends with a reader, so
it is the one path that pays for a picture. When the change is visual, stash it
and retrace the same route to get the **before**, and pair it with Phase 5's
result shot. (The worktree is still standing, which is what keeps that before
shot reachable this late.) Leave the PR open with its proof complete and a
comment naming the reason — the confirmed finding, the destructive migration, or
the issue's `park` tag; move the issue to **In Review** with the same comment;
`add parked` with what was built, what blocked it, the decision being asked and
the `/merge NN` line that resumes it. The refusal streak resets on a park — it
found safe work, it just found a decision riding along with it. The worktree stays
standing: the user lands the PR later with `/merge` from inside it, so the reap
hook still fires. Dependents of a parked issue stay blocked until the user merges
or cancels it.

## Phase 8 — Record and hand back

1. `add landed` with the class, the PR, what changed, the proof and — for B and
   D — `seeIt`, where in the app the user looks for it. A park was already
   recorded in Phase 7. If the issue carried `next`, remove the label now. For a
   checklist issue, the row is the title, and the issue stays In Progress until
   its last row is ticked.
2. One line per tick, narrated and `add log`ged, so the loop reads back as a
   list:
   `[HAB-88 · B · tick 3] merged #71 · composer clears on echo · jest + one shot`
3. **Under `/loop`**: after a landed or parked tick, `ScheduleWakeup` with
   `noop: false` and a short delay (60–120s — the next tick's work is local, and
   nothing is being waited on). After an idle tick, `noop: true` and 1200–1800s.
   **"Idle" here means Phase 1 found nothing Ready — never the tick you just
   finished.** A tick that merged or parked hands straight back to work already
   sitting in the queue, so it takes the short delay. This line overrides
   `ScheduleWakeup`'s own pacing guidance, whose three cases are external
   polling, a fallback heartbeat, and an idle tick with nothing to watch: a
   finished tick with a non-empty queue is none of them, and rounding it to the
   last one buys 20–30 minutes of dead time before the next build starts.
   If Phase 1's stop conditions are met, call it with `stop: true` and hand back
   the report: its path, and its *Needs your decision* section inline. The
   report is the run summary; do not write a second one.

## `/autopilot sweep` — feed the spec pipeline

Not part of a tick. Run whenever the user wants candidates.

1. Sweep for candidates of any class, class D included. A sweep files into
   `Backlog`, which is a proposal and not an approval, and `/autopilot ready`
   already rejects a D issue missing what-to-change, how-it-is-proved or
   what-not-to-touch. Write those three sections where the sweep can; file it
   with the missing one named where it cannot, so the user fills the gap
   instead of the queue losing the idea. The cheap measurements:
   `grep -rnE "borderRadius: [0-9]|padding[A-Za-z]*: [0-9]|margin[A-Za-z]*: [0-9]"`
   under `apps/mobile`, cross-referenced against `apps/mobile/constants/theme.ts`;
   components with branching logic and no `utils/`; suites that cover one happy
   path around real branching; skills in `packages/coach-skills` naming tools
   that no longer exist.
2. **Dedup against Linear.** A sweep that re-files the backlog wastes the run.
3. Rank by payoff, cut to 12–15, and **file the survivors in `Backlog`** with the
   class in the title prefix, the exact files and lines, and a `Work` section
   naming the change — written so a tick needs nothing from this conversation.
   Then stop. **A sweep never touches `Ready`**: promotion is the user's move,
   because promotion is the approval.

## `/autopilot ready <numbers>` — spec-check and promote

The user names issues to promote; the naming is the intent, but the gate still
runs. `/autopilot ready 88 83` means HAB-88 and HAB-83 — bare numbers get the
team prefix, full ids are accepted too.

1. Fetch every named issue first. An id that does not resolve, or an issue
   already `Done`/`Canceled`, is reported and skipped; it never blocks the
   others.
2. Read each issue and assign its class (A/B/C/D), prefixing the title if nothing
   has yet. An issue that fits no class — a design decision, a change with no
   bounded proof — is **rejected now**, with the reason commented, rather than
   burned as a mid-run refusal.
3. **A class D issue missing what-to-change, how-it-is-proved, or what-not-to-
   touch is rejected the same way**, with the missing part named. An A–C issue
   whose `Work` section would not let a tick execute without this conversation
   gets it written now, from what the issue and the code say.
4. Flag any issue whose schema is destructive (a drop, a narrowing, a
   overwriting backfill) with a `park` note in its body, so the tick knows before
   it starts.
5. Declare the chains: where the promoted issues depend on each other or on open
   work, set the Linear `blocked by` relations now, never mid-run.
6. Move the survivors to **Ready** and report each with its class, its one-line
   change, and the expected clock, plus the rejects and why. End with the
   command: `/loop /autopilot`.

`/autopilot ready 115 --next` (or `next 115` on its own, for an issue already in
Ready) applies the `next` label so the next tick takes that issue before
anything else. It is the answer to "bump this up" — never retitle an issue to a
smaller class to jump the queue.

## `/autopilot status` / `stop`

`status`: print the `Ready` list in pick order, with blocked flags and the
`next` pin marked, the issue in `In Progress` if any, and the output of
`node scripts/autopilot-run.mjs status` — the report's header line and path. No
work. `stop`: `node scripts/autopilot-run.mjs close stopped`, then
`ScheduleWakeup` with `stop: true` and hand back the report as Phase 8 does.
