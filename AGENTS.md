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
pnpm wt:new [--db] [--no-sim] feat/hab-NN-slug   # create — flags BEFORE the branch
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
- The operative version of this call, together with the simulator one, is the
  **`wt`** skill's *Routing* section. `start` and `autopilot` both read it
  rather than carrying their own copy, so there is one table to change.
- **Merged migrations are immutable.** Fix forward with a new migration. `db push`
  matches by version timestamp, so editing an applied file does nothing — that is
  what `pnpm wt:db:reset` is for, on a branch DB.
- **Never push migrations to production by hand.** The CI `deploy` job does it on
  merge to `master`, after tests pass.
- A branch database starts with an empty `auth.users`, so `wt:setup --db` seeds
  the test account into it (`pnpm seed`) once the migrations are applied, and
  `pnpm wt:db:reset` re-seeds after every reset. Shared mode is never seeded
  automatically.
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

A worktree's simulator is a fresh install, so it always starts **signed out**.
The account is `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `apps/api/.env`
(gitignored, and copied into every worktree by `wt:setup`);
`python3 .claude/skills/simulator-driving/sim.py login` signs in with it and
says `already signed in` when there is nothing to do.

`pnpm seed` puts that account into a known state — 2 overdue, 2 open and 2
completed tasks today, 4 habits with history, 2 journal entries — so a visual
proof has something to photograph. It deletes and rewrites only the fixture
tables, and only that account's rows. **In shared mode it is the live project
and every shared-mode simulator is signed into that same account**, so a run
changes what all of them are looking at; run it when your proof needs the
fixture state, not by habit.

The **`simulator-driving`** skill drives the UI: tap by accessibility label
(`simctl` cannot tap — `idb` can), read the screen, and clear the two blockers
that trap agents here, the Expo dev-menu sheet and the SpringBoard alert.

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

Two conventions the gate enforces beyond the obvious:

- **`max-lines`, 300, code only.** A file over it is doing more than one thing.
  Splitting it is the fix; moving styles out to duck the cap is not. A file that
  cannot come under carries a file-level `eslint-disable max-lines` naming the
  issue that will, so every exception has an owner and an end.
- **`pnpm knip`** resolves the whole import graph and finds dead files, dead
  exports and unused dependencies — the question ESLint cannot answer, since it
  sees one file at a time. Configured in `knip.json`; not in the gate or CI yet,
  because HAB-90 is still clearing its first report.

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

## 13. Hosting (`deploy/`)

The API runs on a Hetzner CX23 (`habitron-api`, 91.98.45.41, 4 GB — a coach
turn peaks around 650 MB in the container, so 512 MB PaaS tiers OOM) behind
Caddy at `https://91.98.45.41.nip.io`. `ci.yml` → `deploy-api` builds
`apps/api/Dockerfile` after the gate, streams the image over SSH
(`docker save | docker load`, no registry) and runs `deploy/deploy.sh`, which
brings up `deploy/compose.yml` and waits for `/health`.

On the box: `/opt/habitron/.env` holds `API_HOST`, the Supabase service role,
`OPENAI_API_KEY` (Whisper), `CLAUDE_CODE_OAUTH_TOKEN` and `API_TAG`. Deploy
credentials are the `DEPLOY_SSH_KEY` / `DEPLOY_HOST` / `DEPLOY_KNOWN_HOSTS`
repo secrets (user `deploy`). Logs: `ssh deploy@91.98.45.41 'cd /opt/habitron
&& docker compose logs -f api'`. `pnpm --filter @habits-coach/mobile
build:device` bakes the API URL into the phone build.

## 14. App errors: Sentry first

When the user reports an error seen in the app ("trouble processing", a crash,
a blank screen), the answer is already in Sentry: the mobile app reports every
caught failure with tags (`feature`, `stage`) and the real exception message.
Org `thrive-aq` (EU region, `https://de.sentry.io`), project id
`4510715469561936`; the coach tags its chat failures `stage:chat_generation`.

- **Go to Sentry before anything else.** Read the latest event for the tag,
  then reason from the real error. Do not reconstruct the error from server
  logs, Caddy logs, or a simulator repro — those are hours, Sentry is seconds.
- The `SENTRY_AUTH_TOKEN` in the shell is the source-map upload token
  (`org:ci` only) and **cannot read events** (403 on every org endpoint). If no
  token with `event:read` + `org:read` + `project:read` is at hand, **stop and
  ask the user for one immediately**, in the first reply — never fall back to a
  longer path without asking. Store it as `SENTRY_READ_TOKEN`, separate from
  the upload token.
- API: `curl -H "Authorization: Bearer $SENTRY_READ_TOKEN"
  "https://de.sentry.io/api/0/organizations/thrive-aq/issues/?query=stage:chat_generation&statsPeriod=24h"`
  then `/api/0/issues/<id>/events/latest/` for the exception and breadcrumbs.

## 15. Conductor

Conductor stores repo settings in its own database, not in a repo-level config
file. Configure once in the Conductor app (Repo settings → Scripts):

- **Setup script:** `./scripts/setup-worktree.sh`
- **Archive script:** `./scripts/teardown-worktree.sh`
- **Run script:** `pnpm dev`

Both scripts are the same ones `wt:*` calls, so a Conductor workspace and a
`pnpm wt:new` worktree are the same thing and appear together in `pnpm wt:list`.

## 16. Unattended work: hunt and autopilot

Two skills feed and drain a queue that runs without supervision. Both were
ported from planazo, loosened for the fact that this app has exactly one user.

- **`hunt`** — finds *one* qualified improvement, reports it, and stops. Filing
  it and starting work happen only on your say-so.
- **`autopilot`** — drains Linear's **Ready** state, one issue per tick: build,
  gate, review, merge from inside the worktree, record, stop. `Ready` is the
  approval, so promoting an issue is the decision; `/autopilot sweep` files
  candidates into Backlog and `/autopilot ready <numbers>` promotes them.
  `/loop /autopilot` keeps it draining.

Work is classed **A swap · B fix · C extract · D slice**, and the class picks
the proof (§9). A change to `packages/coach-skills` or the `packages/habitron`
tool surface adds `coach:smoke` to its proof, whatever its class.

What a tick may do freely: bigger slices, whole-screen visual work, additive
schema. What it never does: two concerns in one commit, a merge on red or
unchecked CI, a merge from outside the worktree, or a destructive migration —
those park for you, because a revert does not bring data back.
