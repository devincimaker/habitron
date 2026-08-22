# Habitron MCP server

Exposes the Habitron data (tasks, habits, daily plans, journal, memories) to any MCP host — Claude Code, Claude Desktop — so day planning can happen in a strong model that also has access to calendar, Linear, and email tools.

It talks to Supabase directly with the service-role key and acts as the single owner account (`HABITRON_USER_ID`). It is local-only; never expose it over a network.

## Run

```bash
cp apps/mcp/.env.example apps/mcp/.env   # fill in values
pnpm --filter @habits-coach/mcp start     # stdio server
```

The server is registered project-scoped from the `~/Coach` folder (its `.mcp.json` points at this entrypoint), so it loads only for terminals opened there. The coaching skills (`/plan-day`, `/review-day`) live in `~/Coach/.claude/skills`, not in this repo — this package is tools only.

## Tools

| Read | Write |
| --- | --- |
| `get_day_context` (the planning packet) | `create_task`, `update_task`, `set_task_status`, `delete_task` |
| `list_tasks`, `list_habits`, `list_memories` | `log_habit` |
| `get_habit_history`, `get_task_history`, `get_journal_history`, `get_plan_history` (learning from the past) | `save_day_plan`, `set_plan_item_outcome` |
| | `add_journal_entry`, `add_memory`, `delete_memory` |

`save_day_plan` enforces the invariant from `docs/v1-coach-planning-implementation-plan.md`: every todo item in an accepted plan is also scheduled on that date at the item's time, so the plan and the Tasks screen never drift. Saving again for the same date supersedes the previous version and links it via `parentPlanId`.

## Layout

- `src/db.ts` — Supabase reads/writes, one function per operation
- `src/context.ts` — builds the compact day packet (`get_day_context`)
- `src/history.ts` — habit / task / journal history and stats over a window
- `src/server.ts` — tool registration (zod-validated)
- `src/time.ts` — timezone-aware "today", weekday, week range helpers
