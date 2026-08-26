# Habitron MCP server

Exposes the Habitron data (tasks, habits, daily plans, journal, memories) to any MCP host — Claude Code, Claude Desktop — so day planning can happen in a strong model that also has access to calendar, Linear, and email tools.

It is a thin stdio wrapper: the data layer and the tool definitions live in `packages/habitron`, and the in-app coach (`apps/api`) registers the very same tool list on the Agent SDK's in-process MCP server. One tool surface, two hosts.

It talks to Supabase directly with the service-role key and acts as the single owner account (`HABITRON_USER_ID`). It is local-only; never expose it over a network.

## Run

```bash
cp apps/mcp/.env.example apps/mcp/.env   # fill in values
pnpm --filter @habits-coach/mcp start     # stdio server
```

The server is registered project-scoped from the `~/Coach` folder (its `.mcp.json` points at this entrypoint), so it loads only for terminals opened there. The coaching skills (`/coach`, `/plan-day`, `/review-day`, `/review-habits`, `/first-session`) live in `packages/coach-skills`, symlinked into `~/Coach/.claude/skills`.

## Tools

| Read | Write |
| --- | --- |
| `get_day_context` (the planning packet) | `create_task`, `update_task`, `set_task_status`, `delete_task` |
| `list_tasks`, `list_habits`, `list_tags`, `list_memories` | `create_tag`, `update_tag`, `delete_tag`, `log_habit`, `set_checklist_item_done` |
| `get_habit_history`, `get_task_history`, `get_journal_history`, `get_plan_history` (learning from the past) | `save_day_plan`, `set_plan_item_outcome` |
| | `add_journal_entry`, `add_memory`, `delete_memory` |

Tags are categories: every task carries at most one (`tag` on every task returned by `list_tasks`, `get_day_context`, and `get_task_history`, whose `summary.byTag` breaks completed work down per category). `create_task` / `update_task` take a `tagId` (null clears it) and reject unknown ids. `update_tag` renames or recolours one without touching its tasks; `delete_tag` removes it and leaves its tasks uncategorised unless you pass `reassignToTagId` to move them first.

Work that is **already done** is created completed rather than added and then ticked: `create_task` takes `completedAt` (`YYYY-MM-DDTHH:MM`, local wall clock) and, alongside it, `actualMinutes`. Passing `actualMinutes` without `completedAt` is rejected — on a task that already exists, that belongs to `set_task_status`. Set `scheduledDate`/`scheduledTime` to the same moment: `completedAt` is what the history and `get_day_context.completedOnDate` read, while the Calendar day filters on `scheduled_date`, so a log with only one of them goes missing from the other. Completion and cancellation dates are read in the user's timezone throughout, so work finished after midnight counts for the day it felt like.

Tasks can carry a **checklist**: an ordered list of small items ticked off individually ("I need milk, eggs and bread" is one task with three items, not three tasks). `create_task` / `update_task` take `checklist: string[]` — on update it replaces the full list (`[]` clears it) but keeps done state for items whose title matches. `set_checklist_item_done { itemId, done }` ticks one item. Every task returned by `list_tasks`, `get_day_context`, and `get_task_history` includes `checklist` (id, title, done, position); `get_day_context` tasks with a checklist also get `checklistProgress: { done, total }`.

`save_day_plan` enforces the invariant from `docs/v1-coach-planning-implementation-plan.md`: every todo item in an accepted plan is also scheduled on that date at the item's time, so the plan and the Tasks screen never drift. Saving again for the same date supersedes the previous version and links it via `parentPlanId`.

## Layout

- `src/index.ts` — stdio server; registers `packages/habitron` tools on an `McpServer`
- `src/config.ts` — env (`apps/mcp/.env`)
- `packages/habitron/src/db.ts` — Supabase reads/writes, one function per operation
- `packages/habitron/src/context.ts` — the compact day packet (`get_day_context`)
- `packages/habitron/src/history.ts` — habit / task / journal history and stats over a window
- `packages/habitron/src/tools.ts` — the tool list (zod-validated), shared with the in-app coach
