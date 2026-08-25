---
name: wt
description: Drive Habitron's worktree and database workflow — create/setup/list/remove worktrees, choose shared vs --db mode, iterate on migrations against a branch database, and interpret every guard refusal. Use when creating or working in a worktree, when a wt:* command refuses to run, or when managing Supabase branch databases.
---

# Habitron worktree & database driver

The one rule everything reduces to: **your database is whatever this checkout's
`.env.worktree` says.** `wt:setup` writes it, and the guards below enforce the
boundaries. Your job is to pick the right command, not to reason about safety.

The thing that makes this repo different from most: **shared mode is the live
database.** There is no local Supabase stack here. A shared worktree points at
`fitklsshlhjwddbxhhdi`, the same project the App Store build and the Render API
use. Running a migration there is not a dev convenience, it is a production
schema change.

## Routing: the two calls, and who owns them

**This section is the single owner of both decisions.** `start` and `autopilot`
route through it rather than restating it — a routing table written twice is a
table that drifts, and a drifted one sends a tick to a different database than
you would have picked. Change the rule here; do not copy it out.

Read the Linear issue first (`mcp__linear__get_issue`, team **Habitron**) —
never guess from the issue number. Then log both calls in one line with their
reasons: `feat/hab-83-day-ratings · --db (new table) · no simulator (coach-only)`.

### Database — `--db` or shared

- **`--db` (own branch database)** whenever the work implies a schema change:
  migrations, RLS or policies, RPCs, triggers, new tables/columns/indexes,
  `SECURITY DEFINER`.
- **shared (default)** for everything else: UI, copy, styling, navigation,
  state, API route logic, tests, config. Free and instant.
- Genuinely ambiguous → **shared**. Upgrading later is one command
  (`pnpm wt:setup --db`); guessing `--db` wrongly costs money and minutes.

The asymmetry to remember: a wrong "shared" that turns out to need schema costs
you one command. A migration run against shared mode costs you production.

An issue that leaves an unattended run guessing about schema is incomplete —
`autopilot` refuses it back to `Todo` rather than picking.

### Simulator — build one or `--no-sim`

- **Build one (the default)** when the work changes something on screen: UI,
  copy, navigation, styling, state, loading and error states.
- **`--no-sim`** when nothing lands on screen: data layer, coach skills, API
  routes, pure logic, tests.
- Genuinely ambiguous → **`--no-sim`**. `pnpm wt:setup --sim` builds one the
  moment the diff proves you need it.

This call is cheap in both directions, which is why it defaults the opposite
way from the database one. When the proof is a test or a diff rather than a
screenshot, there is nothing for a simulator to do.

## Commands

```bash
pnpm wt:new fix/hab-NN-slug            # new worktree, shared mode
pnpm wt:new feat/hab-NN-slug --db      # new worktree with its own branch DB
pnpm wt:new chore/hab-NN-slug --no-sim # no simulator: nothing on screen changes
pnpm wt:setup --db                     # upgrade an existing worktree to its own DB
pnpm wt:setup --no-db                  # move it back to shared (deletes the branch DB)
pnpm wt:setup --sim                    # build the simulator after all
pnpm wt:list                           # all worktrees; flags merged branches + orphaned DBs
pnpm wt:rm <branch>                    # worktree + simulator + branch DB, all of it
pnpm wt:db:reset                       # wipe + re-apply migrations on THIS branch DB
pnpm dev                               # boot this worktree's simulator + Metro + API
```

`pnpm wt:new` takes a Bash timeout of **600000** when `--db` is passed: branch
database provisioning takes minutes and a default timeout kills it midway.

## What a worktree owns

`.env.worktree` is the ledger, and every script reads it rather than guessing:

| Key | What it is |
| --- | --- |
| `WT_DB_MODE` | `shared` or `branch` |
| `WT_BRANCH_NAME` / `WT_BRANCH_REF` | the Supabase branch and its project ref, when in branch mode |
| `WT_EXPO_PORT` / `WT_API_PORT` | this worktree's Metro and API ports |
| `WT_SIM_NAME` / `WT_SIM_UDID` | the simulator created for this worktree |
| `WT_SIM_MODE` | `device`, or `none` when set up `--no-sim` |

Ports are also claimed in `~/.conductor/state/resources.json`, which is shared
with every other repo on this machine, so nothing here collides with `ronda` or
`planazo`. Simulators are created per worktree and named `thrive-<slug>`, so
there is no pool to run out of.

Read the ledger when you enter a worktree, and report the slot in one line.
Never assume the main checkout's values.

## How a branch database gets its schema

**Supabase applies this repo's migrations itself when it provisions a branch.**
`wt:setup --db` does not push them on creation; it waits until the database
reports every local migration as applied, and only pushes the gap if one is
left. That is deliberate, and the reason is worth knowing:

The branch's status field reaches `FUNCTIONS_DEPLOYED` *before* the migration
phase finishes. Pushing on the strength of that status means two writers apply
the same files at once and then collide inserting the same row into
`supabase_migrations.schema_migrations`. The visible result is a branch stuck in
`MIGRATIONS_FAILED` whose schema is actually complete, which is about the most
misleading pair of facts the setup can hand you.

So when a branch says `MIGRATIONS_FAILED`, check what the database has before
believing it:

```bash
supabase migration list --db-url "$SUPABASE_DB_URL"
```

Local and remote columns matching on every row means the schema is fine.

## Iterating on migration SQL (`--db` worktrees)

`db push` matches migrations by **version timestamp, not content**. The first
apply of a new file works; once a version is recorded, editing its file does
nothing — push skips it silently. So the loop is:

1. Write the migration → `pnpm wt:setup --db` (or `supabase db push --db-url`)
   applies it.
2. Need to change it? Edit the file, then **`pnpm wt:db:reset`** — wipes the
   branch DB and re-applies every migration from the current files. The app
   then needs a re-login (fresh JWTs) and Metro a `--clear` restart.
3. Never renumber or edit a migration that is already on `master`. Fix forward
   with a new migration.

## Hard boundaries (the scripts enforce these — do not fight them)

- **Never run a migration from a shared-mode worktree.** That is the live
  database. `pnpm wt:setup --db` first.
- **Never touch another worktree's simulator, port, or branch database.**
  `pnpm wt:list` shows ownership. A worktree you did not create may belong to
  another session that is mid-flight.
- **Never push migrations to production by hand.** The CI `deploy` job does it
  on merge to `master`, after tests pass.
- **Never delete a worktree to escape a failed setup.** Setup is idempotent and
  prints the exact retry line. By the time it can fail it may already own a
  billable branch database recorded only in that worktree's ledger, and
  deleting the directory orphans it.

## When a command refuses — meaning and fix

Refusals are the guards working, not the tooling being broken. Run the named
remedy; do not work around one.

| Message contains | It means | Fix |
| --- | --- | --- |
| "Uncommitted work in …" | `wt:rm` found a dirty tree | commit or stash, then re-run. `--force` only when you mean to throw the work away |
| "Unpushed commits on …" | the branch has local-only commits | push them, then re-run |
| "could not delete branch database" | Supabase refused, and teardown stopped on purpose | run the `supabase branches delete` line it printed, then re-run teardown. The ledger still names the branch, which is why stopping was right |
| "Refusing to switch to shared mode while it may still exist and bill" | a `--no-db` downgrade could not delete the branch | delete it by hand with the printed command, then re-run |
| "This worktree is in 'shared' mode" (from `wt:db:reset`) | you tried to reset the live database | `pnpm wt:setup --db` if this branch needs its own |
| "SUPABASE_DB_URL points at '…' but this worktree's branch is '…'" | the ledger and the URL disagree | re-run `pnpm wt:setup --db` |
| "That is the live project ref. Never." | a reset was aimed at production | stop. Something is badly wrong with the ledger; re-run setup |
| "No such directory" / "is not a worktree of this repository" | wrong path | `pnpm wt:list` for the real ones |
| "The worktree was created but setup did not finish" | setup died mid-run | run the `pnpm wt:setup …` retry line it printed. Do not delete and start over |
| "This worktree was set up with --no-sim" | `pnpm dev` has no simulator to run on | `pnpm wt:setup --sim` if the change turned out to be visible |

## After merging

**This is automatic for the worktree you are in.** A `PostToolUse` hook on
`gh pr merge` (`.claude/settings.json`) runs `scripts/worktree-reap.sh`, which
reclaims THIS worktree — directory, simulator, branch DB, local branch — and
then pulls `master`. It reclaims nothing else: other worktrees belong to other
sessions, and their branch databases are live.

It refuses rather than deletes when the PR for the branch is not `MERGED`, or
when `wt:rm` objects (a dirty tree, most often). When it refuses it says why,
and the fix is yours to carry out; it never retries itself.

**A browser merge fires no hook**, because the hook only sees the Bash tool
call. Reclaim by hand with `pnpm wt:rm <branch>`.

Other people's merged worktrees show up in `pnpm wt:list` flagged `MERGED`.
That is a prompt for whoever owns them, not a to-do list. Ask before reclaiming
one you did not create. A `branch`-mode one says its database is billing,
because that flag costs money for as long as it goes unread.

The flag is a merged-PR question, asked of GitHub. If `wt:list` says it could
not reach GitHub, believe it: nothing is flagged that run, and a finished
worktree looks exactly like an unfinished one. The same is true of the orphaned
branch-database scan at the bottom of the listing.
