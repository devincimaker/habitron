# Habitron MCP server

Exposes the Habitron data (tasks, habits, daily plans, journal, memories) to any MCP host — Claude Code, Claude Desktop — so day planning can happen in a strong model that also has access to calendar, Linear, and email tools.

It is a thin stdio wrapper: the data layer and the tool definitions live in `packages/habitron`, and the in-app coach (`apps/api`) registers the very same tool list on the Agent SDK's in-process MCP server. One tool surface, two hosts.

It talks to Supabase directly with the service-role key and acts as the single owner account (`HABITRON_USER_ID`). It is local-only; never expose it over a network.

## Run

```bash
cp apps/mcp/.env.example apps/mcp/.env   # fill in values
pnpm --filter @habits-coach/mcp start     # stdio server
```

The server is registered project-scoped from the `~/Coach` folder (its `.mcp.json` points at this entrypoint), so it loads only for terminals opened there. The coaching skills (`/coach`, `/plan-day`, `/review-day`, `/review-habits`, `/review-goals`, `/first-session`) live in `packages/coach-skills`, symlinked into `~/Coach/.claude/skills`.

## Tools

| Read | Write |
| --- | --- |
| `get_day_context` (the planning packet) | `create_task`, `update_task`, `set_task_status`, `delete_task` |
| `list_tasks`, `list_habits`, `list_tags`, `list_lists`, `list_memories` | `create_tag`, `update_tag`, `delete_tag`, `log_habit`, `set_checklist_item_done` |
| | `create_list`, `update_list`, `delete_list` |
| `get_habit_history`, `get_task_history`, `get_journal_history`, `get_plan_history` (learning from the past) | `save_day_plan`, `set_plan_item_outcome` |
| `get_day_review_history` | `save_day_review` |
| | `create_habit`, `update_habit`, `archive_habit`, `restore_habit` |
| `list_desired_habits` | `add_desired_habit`, `update_desired_habit`, `delete_desired_habit` |
| `list_goals` | `create_goal`, `update_goal`, `complete_goal`, `delete_goal` |
| | `add_journal_entry`, `add_memory`, `delete_memory` |

Tags are categories: every task carries at most one (`tag` on every task returned by `list_tasks`, `get_day_context`, and `get_task_history`, whose `summary.byTag` breaks completed work down per category). `create_task` / `update_task` take a `tagId` (null clears it) and reject unknown ids. `update_tag` renames or recolours one without touching its tasks; `delete_tag` removes it and leaves its tasks uncategorised unless you pass `reassignToTagId` to move them first.

Lists group tasks the way the app's drawer shows them: every task lives in exactly one list (`listId` on every task), and the Inbox is the default. `create_task` / `update_task` take a `listId` or a case-insensitive `listName` and reject unknown ones — lists are made deliberately with `create_list`, never as a side effect. `list_tasks` filters by the same pair. `update_list` renames or recolours; `delete_list` never deletes tasks — they move to the Inbox in their old order, and the Inbox itself cannot be deleted.

Habits are the coach's to start and shape, not just to log. `create_habit` takes a frequency — `daily` (optionally pinned to `weeklyDays`), `weekly` (`weeklyCount` times a week) or `interval` (every `intervalDays`) — and a goal that is either boolean or a `quantity` counted towards `targetAmount` in its `unit`. The coupling is enforced rather than ignored: a field belonging to another mode is an error naming the conflict, and **weekday pinning belongs to `daily`, not `weekly`**, matching the app. `section` is an existing section's name, resolved case-insensitively; an unknown one errors and lists the real names, because sections are created in the app. `update_habit` is a patch — only what you pass is written — and changing `frequency` or `goalType` rewrites that mode and clears the old one. `archive_habit` / `restore_habit` flip `active`; there is deliberately **no** `delete_habit`, because deleting a habit takes its logs with it and that is not recoverable.

**Day reviews** rate one day on four axes plus a verdict, all 1-5 and all running the same direction — higher is better, which is why the axis is `calm` and not `stress`. `happy` (is doing what I plan making me happy), `momentum` (did it move the needle), `energy` (am I overexerting), `calm` (is the plan crowding me), and `overall`, which is the gut verdict and is never computed from the other four. An absent axis means *not asked*: `save_day_review` writes only the fields it is passed, so the three beats of `/review-day` are three merging writes to one row and `depth` only ever moves deeper. `get_day_context` carries `scorecard` — the day already counted, so the review never asks for a number it can compute — and `review`, today's row if it exists, so a second visit resumes instead of restarting. The scorecard counts only what can actually be done or missed: plan `note` items are guidance with nothing to resolve and are left out, and a weekly-count habit owes N times a week rather than something today, so it appears under `habitsThisWeek` instead of as a miss. `tasks.trackedMinutes` is the total `minutesByTag` sums (actual where logged, estimate where not), so the card's total and its per-category breakdown cannot contradict each other. `get_day_review_history(days)` adds per-axis averages, a first-half/second-half trend, `reviewed / days`, and the streak (consecutive reviewed days, where today still pending does not break it). Nothing computed is stored on the row: adherence, habit counts and minutes are recomputed, so editing a task later never leaves a stale snapshot behind.

**Desired habits** are the habits the user has decided they want but has not started. `get_day_context.desiredHabits` carries each one with `workingOnIt` already resolved — the habit standing in for it (`id`, `name`, `active`, `frequency`, `startDate`, `completedLast14Days`) or `null`, resolved against archived habits too, since an abandoned attempt is signal about what was tried. `list_desired_habits` returns the same rows unresolved. Starting one is `create_habit` then `update_desired_habit` with that habit's id; `update_desired_habit` is a patch, and `habitId: null` puts the row back to not-started. How the coach is meant to *use* the list — a direction rather than a queue — lives in `packages/coach-skills/CLAUDE.md`, not here.

**Goals** are outcomes that end: `title`, `measure` (how the user will know it is done) and a required `targetDate`. `get_day_context.goals` carries the open ones with `daysLeft`, `reviewedAt` and `tasks: { done, total }`, nearest date first; `list_goals` carries the same goals with the tasks themselves (`includeDone` adds the finished ones). A task that moves a goal carries `goalId` — on `create_task`, `update_task` (null unlinks) and every task returned — and an unknown id is rejected like an unknown `tagId`. `update_goal` is a patch; `reviewed: true` stamps `reviewedAt` now, which is how `/review-goals` records that a goal was looked at. `complete_goal` stamps `completedAt`; `delete_goal` leaves the tasks, unlinked. The **Goals module** can be switched off in Profile: `createHabitron` reads `user_profiles.disabled_modules` once and then registers no goal tool and puts no `goals` in the packet, so the coach cannot see what the app hides.

Work that is **already done** is created completed rather than added and then ticked: `create_task` takes `completedAt` (`YYYY-MM-DDTHH:MM`, local wall clock) and, alongside it, `actualMinutes`. Passing `actualMinutes` without `completedAt` is rejected — on a task that already exists, that belongs to `set_task_status`, which takes the same `completedAt` and defaults to now without it; passing one while reopening or cancelling is rejected, since those clear the stamp. Set `scheduledDate`/`scheduledTime` to the same moment — with `update_task` when the task already existed: `completedAt` is what the history and `get_day_context.completedOnDate` read, while the Calendar day filters on `scheduled_date`, so a log with only one of them goes missing from the other. Completion and cancellation dates are read in the user's timezone throughout, so work finished after midnight counts for the day it felt like.

Tasks can carry a **checklist**: an ordered list of small items ticked off individually ("I need milk, eggs and bread" is one task with three items, not three tasks). `create_task` / `update_task` take `checklist: string[]` — on update it replaces the full list (`[]` clears it) but keeps done state for items whose title matches. `set_checklist_item_done { itemId, done }` ticks one item. Every task returned by `list_tasks`, `get_day_context`, and `get_task_history` includes `checklist` (id, title, done, position); `get_day_context` tasks with a checklist also get `checklistProgress: { done, total }`.

`save_day_plan` enforces the invariant from `docs/v1-coach-planning-implementation-plan.md`: every todo item in an accepted plan is also scheduled on that date at the item's time, so the plan and the Tasks screen never drift. Saving again for the same date supersedes the previous version and links it via `parentPlanId`.

## Layout

- `src/index.ts` — stdio server; registers `packages/habitron` tools on an `McpServer`
- `src/config.ts` — env (`apps/mcp/.env`)
- `packages/habitron/src/db.ts` — Supabase reads/writes, one function per operation
- `packages/habitron/src/context.ts` — the compact day packet (`get_day_context`)
- `packages/habitron/src/history.ts` — habit / task / journal history and stats over a window
- `packages/habitron/src/tools.ts` — the tool list (zod-validated), shared with the in-app coach
