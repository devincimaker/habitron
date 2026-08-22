# Habitron MCP server

Exposes the Habitron data (tasks, habits, daily plans, journal, memories) to any MCP host — Claude Code, Claude Desktop — so day planning can happen in a strong model that also has access to calendar, Linear, and email tools.

It talks to Supabase directly with the service-role key and acts as the single owner account (`HABITRON_USER_ID`). It is local-only; never expose it over a network.

## Run

```bash
cp apps/mcp/.env.example apps/mcp/.env   # fill in values
pnpm --filter @habits-coach/mcp start     # stdio server
```

Register with Claude Code (user scope, so it is available from any directory):

```bash
claude mcp add --scope user habitron -- npx tsx /path/to/thrive/apps/mcp/src/index.ts
```

Then in any session: `/mcp__habitron__plan_day` or `/mcp__habitron__review_day`.

## Surface

Prompts (the "skills"):

- `plan_day [date]` — intake → draft → confirm → `save_day_plan`
- `review_day [date]` — record outcomes, journal, durable lessons

Tools:

| Read | Write |
| --- | --- |
| `get_day_context` (the planning packet) | `create_task`, `update_task`, `set_task_status`, `delete_task` |
| `list_tasks`, `list_habits`, `list_memories` | `log_habit` |
| `get_plan_history` | `save_day_plan`, `set_plan_item_outcome` |
| | `add_journal_entry`, `add_memory`, `delete_memory` |

`save_day_plan` enforces the invariant from `docs/v1-coach-planning-implementation-plan.md`: every todo item in an accepted plan is also scheduled on that date at the item's time, so the plan and the Tasks screen never drift. Saving again for the same date supersedes the previous version and links it via `parentPlanId`.

## Layout

- `src/db.ts` — Supabase reads/writes, one function per operation
- `src/context.ts` — builds the compact day packet (`get_day_context`)
- `src/server.ts` — tool and prompt registration (zod-validated)
- `src/prompts.ts` — the planning and review prompts
- `src/time.ts` — timezone-aware "today", weekday, week range helpers
