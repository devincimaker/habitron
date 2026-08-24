# Habitron — agent instructions

Canonical for every agent (Claude Code, Codex, Conductor). `CLAUDE.md` just
points here.

Linear: daio / Habitron / **HAB** — https://linear.app/daio/team/HAB/all
Supabase project: `fitklsshlhjwddbxhhdi`. GitHub: `devincimaker/habitron`, default
branch `master`.

## 1. No backwards compatibility

This software has exactly one user: its author. There are no external consumers,
no old clients in the wild, and no API contracts to honour.

- When a new approach is better, commit to it fully. Do not keep the old
  approach alive next to it.
- Do not add fallbacks, shims, legacy branches, `isLegacy*` flags, or "if the old
  column is missing" code paths. Migrate the data and move on.
- Do not keep dead or duplicated code "just in case". If it is not used, delete
  it.
- Do not leave TODOs about backwards compatibility.

## 2. Remove features thoroughly

When a feature or pattern is removed, remove all of it:

- the code, the helpers and utilities only it used, the types, the constants,
- the tests that exercised it,
- the database columns / migrations it needed (via a new migration),
- the docs and comments that referred to it.

The goal is the minimum expression of the code that is actually needed right now.

## 3. A question is not an instruction

When the user asks a question — "did we run X?", "does this handle Y?", "how hard
would Z be?" — answer it and stop. A question is never permission to act on its
subject.

Start work when the user actually says to: an explicit request, a slash command,
or a plan they have agreed. If the answer makes a next step obvious, name it and
offer it; taking it is the user's move.

Related: **a stated goal is a decision already made.** Build it. Do not shrink it
into an optional step 2, and do not re-litigate a choice the user has made. Lead
with the answer, add only the reasoning that changes what they do next, then
stop.

## 4. Development

```bash
pnpm dev          # mobile app + API, on this checkout's ports and simulator
pnpm typecheck    # tsc across every package
pnpm lint         # eslint, one flat config at the root
pnpm test         # jest (mobile) + vitest (api, mcp)
```

`pnpm dev` reads `apps/mobile/.env` for `IOS_SIMULATOR` and `EXPO_PORT` and
`apps/api/.env` for `PORT`. In a worktree those are this worktree's own; never
the main checkout's.

To install a Release build on a physical iPhone without EAS (Xcode automatic
signing, hosted API URL baked in):

```bash
cd apps/mobile && pnpm build:device
```

## 5. Worktrees

The main checkout and its worktrees are both first-class, but only worktrees are
managed by `wt:*`. A worktree owns an Expo port, an API port, and a simulator it
created for itself, all recorded in its `.env.worktree` ledger. Ports are also
claimed in `~/.conductor/state/resources.json`, shared with every other repo on
this machine.

```bash
pnpm wt:new feat/hab-NN-slug [--db] [--no-sim]   # create
pnpm wt:setup [--db|--no-db] [--sim|--no-sim]    # repair or change modes, in place
pnpm wt:list                                     # every worktree, plus leaked branch DBs
pnpm wt:rm <branch>                              # reclaim all of it
pnpm wt:db:reset                                 # re-apply migrations on THIS branch DB
```

Inside a worktree:

- **Read `.env.worktree` first.** Never assume the main checkout's values.
- **Never touch another worktree's simulator, port, or branch database.** One
  may belong to a session that is mid-flight.
- **Never delete a worktree to escape a failed setup.** Setup is idempotent and
  prints its retry line; the worktree may already own a billable branch database
  that only its ledger names.
- Rebuild native only when `app.json` or the native dependency set changes. The
  dev client is a generic shell, so one build serves every simulator.

The **`wt`** skill is the full driver, including every guard refusal and its
remedy. Invoke it rather than working around a refusal.

## 6. Databases and migrations

**Shared mode is the live database.** There is no local Supabase stack in this
repo. A worktree in shared mode points at `fitklsshlhjwddbxhhdi`, the same
project the App Store build and the Render API talk to. Running a migration there
is a production schema change, not a dev convenience.

- **`--db` whenever the work implies schema**: migrations, RLS or policies, RPCs,
  triggers, new tables/columns/indexes, `SECURITY DEFINER`. It provisions a
  hosted Supabase branch for that worktree alone.
- **shared for everything else**, and when genuinely ambiguous. Upgrading later
  is one command; guessing `--db` wrongly costs money and minutes. Guessing
  shared wrongly costs production.
- **Merged migrations are immutable.** Fix forward with a new migration. `db push`
  matches by version timestamp, so editing an applied file does nothing — that is
  what `pnpm wt:db:reset` is for, on a branch DB.
- **Never push migrations to production by hand.** The CI `deploy` job does it on
  merge to `master`, after tests pass.
- A branch database bills hourly for as long as it exists. `pnpm wt:list` flags
  orphans; the merge hook reclaims the worktree you merged from.

## 7. iOS simulator

Use the simulator named in this checkout's `apps/mobile/.env` (`IOS_SIMULATOR`),
which for a worktree is one `wt:setup` created and named `thrive-<slug>`. Never
use a different one, even if another is already booted.

`pnpm dev` boots it, installs the prebuilt dev client if it is new, starts Metro
on this checkout's port, and deep-links the app to that bundler. Deep links use
the `habits-coach` scheme; `wt:setup` pre-approves it so SpringBoard never
prompts.

Do not kill another project's Metro. If a port is taken, `pnpm wt:setup` hands
out a new one.

## 8. Branches, commits, PRs

Branch names are `feat|fix|chore|refactor/hab-NN-<short-slug>`, not Linear's
`gitBranchName`. Branches are decided at the *start* of work, never retrofitted
onto a finished change. If work is already on `master`, commit and push on
`master`: "commit that" means the checkout in front of you.

PRs merge with `--squash`, one commit per PR, so a bad merge reverts in one
`git revert`. Commit messages and PR bodies describe **this** change only: no
follow-ups, no "left alone", no future work. If a pass finds something else, fix
it here when it is the same kind of work, otherwise raise a Linear issue.

## 9. The gate, and verification that matches the change

`pnpm typecheck && pnpm lint && pnpm test` before a PR, and after logic changes.
Not after every four-word edit. Say what you skipped.

| The change is… | The proof is… |
| --- | --- |
| copy, a constant, a comment | the diff |
| logic with nothing on screen | the tests, named |
| a small visual change on one screen | one simulator pass and a screenshot |
| a new flow, several screens, or a redesign | a simulator pass with before/after shots |
| a schema change | the migration applied on a branch DB, plus the tests |
| native dependencies or app config | a native rebuild and simulator verification |
| a rebase that does not touch the verified UI or its dependencies | the existing proof; no rerun |

A new commit hash alone never invalidates proof. Use the changed paths to judge
whether rebased work is materially the same.

## 10. Every user-visible PR ends with proof

Every PR body ends with `## See it working`. Non-visual PRs name the proof diff
or the tests. Visual PRs include a screenshot, the simulator and the deep link
used, and any seed or account state needed to reproduce.

Escalate to the user only when being wrong wastes work: verification you cannot
do, or a call that is theirs to make. "I found it late" is not a reason. If you
can state the correct behaviour in one sentence nobody would argue with, it is
work waiting on you, not a decision waiting on them.

## 11. Landing work

The **`merge`** skill owns this: gate the PR, merge from **inside its worktree**
so the reap hook fires, watch the production migration deploy, close the Linear
issue, then prove each one happened.

A `PostToolUse` hook on `gh pr merge` (`.claude/settings.json`) reclaims the
worktree the merge ran in — directory, simulator, branch database, local branch.
Merging from the main checkout, or from a browser, fires nothing and leaves all
of it standing.

`master` has no branch protection, so `gh pr merge` will merge a red or unchecked
commit. The gate is the only thing in front of that.

## 12. The coach (`packages/coach-skills`, `packages/habitron`, `apps/mcp`, `apps/api`)

One coach, two surfaces. The persona and skills are `packages/coach-skills`
(`CLAUDE.md` + `.claude/skills/*`); the data layer and the tool list are
`packages/habitron`. Add or change tools there, never in `apps/mcp` or `apps/api`.

- **Claude Code** (`~/Coach`): symlinks into `packages/coach-skills`;
  `~/Coach/.mcp.json` registers the stdio MCP server in `apps/mcp` (needs
  `apps/mcp/.env`: Supabase service role + `HABITRON_USER_ID`). Use it when
  planning needs calendar, Linear or email context.
- **In-app** (`apps/api` → `POST /api/chat`): the Claude Agent SDK runs the same
  skills and the same tools in-process and streams the turn to the app. Auth is
  the Claude subscription via `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`);
  locally the Claude Code login is enough.
  `pnpm --filter @habits-coach/api coach:smoke "<prompt>"` runs one turn against
  the test account from the terminal.

See `apps/mcp/README.md` for the tool surface and `docs/coach-skill-map.md` for
the architecture.

## 13. Conductor

Conductor stores repo settings in its own database, not in a repo-level config
file. Configure once in the Conductor app (Repo settings → Scripts):

- **Setup script:** `./scripts/setup-worktree.sh`
- **Archive script:** `./scripts/teardown-worktree.sh`
- **Run script:** `pnpm dev`

Both scripts are the same ones `wt:*` calls, so a Conductor workspace and a
`pnpm wt:new` worktree are the same thing and appear together in `pnpm wt:list`.
