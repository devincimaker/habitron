# V1 Coach Planning Implementation Plan

## Goal

Ship a simple first version where the user only manages:

- Tasks
- Habits
- Journal

The coach should use those three surfaces to help the user decide what to do today. The user can then keep shaping the day either through chat or directly through the UI, without those two paths drifting apart.

## Product Rules

1. Tasks are the source of truth for what is on the user's day.
2. The coach and the UI must use the same underlying task state.
3. A task that the coach puts on today must appear in `Tasks > Today`.
4. A task that the user changes in the UI must immediately change the coach's understanding of the day.
5. Daily plans are a thin planning layer over tasks and habits, not a parallel system.
6. User-facing structure stays simple. Learning happens in the background.
7. Goals are out of scope for v1 and should not be required anywhere in the main flow.

## User Experience Target

### Visible surfaces

- `Tasks`
  - Includes a `Today` section and other task groupings
- `Habits`
- `Journal`
- `Coach`

### Core loop

1. User adds tasks, habits, and occasional journal entries.
2. User asks the coach to plan the day.
3. Coach proposes a day.
4. When accepted, planned tasks appear in `Tasks > Today`.
5. Throughout the day, the user can complete, cancel, or reschedule tasks from the UI.
6. Those changes update the active day plan and create learning signals for future plans.

## Current Architecture Notes

Current code already has the right base:

- `Todo` is already the main task model in [packages/shared/src/types/index.ts](../packages/shared/src/types/index.ts).
- `DailyPlan` and `DailyPlanItem` already exist in [packages/shared/src/types/index.ts](../packages/shared/src/types/index.ts).
- The Tasks screen already works from scheduled tasks by date in [apps/mobile/app/(tabs)/tasks.tsx](../apps/mobile/app/(tabs)/tasks.tsx).
- UI actions already sync some day-plan outcomes in [apps/mobile/app/(tabs)/tasks.tsx](../apps/mobile/app/(tabs)/tasks.tsx).
- Coach proposals already support task add/edit/schedule/unschedule/complete/cancel operations in [packages/shared/src/types/index.ts](../packages/shared/src/types/index.ts) and [apps/mobile/utils/applyCoachProposal.ts](../apps/mobile/utils/applyCoachProposal.ts).

The main missing pieces are:

- a stable day snapshot of planning context
- an event log for day changes
- behavior-derived learning that feeds future coach recommendations
- a simpler product shape that treats tasks, habits, and journal as the only visible primitives

## Target System Design

### Source of truth

- `todos` is the source of truth for tasks
- `habits` is the source of truth for recurring actions
- `journal_entries` is the source of truth for reflective context
- `daily_plans` is a snapshot of what the user accepted for a given day

### What the plan layer is responsible for

- storing concrete scheduled times for the plan
- storing rationale
- marking tasks or habits as optional vs core
- storing accepted versions of the day
- recording outcomes for planned items

### What the plan layer is not responsible for

- owning task state
- replacing the task list
- becoming a separate user-managed module

## Data Model Changes

### 1. Simplify visible model around tasks, habits, journal

Keep goals in the codebase only if needed to avoid breaking existing code during transition, but remove them from the main product flow and from coach requirements.

For v1 planning behavior, the coach should only rely on:

- open tasks
- tasks already scheduled for the day
- habits and their completion patterns
- recent journal entries
- existing memories
- active accepted plan

### 2. Extend `daily_plans` with a context snapshot

Add a new `context_snapshot JSONB` column to `daily_plans`.

Purpose:

- preserve what the system knew when the plan was accepted
- compare plan quality against actual execution later
- avoid reasoning only from the final state

Suggested initial shape:

```json
{
  "date": "2026-04-12",
  "journalMood": "neutral",
  "journalSummary": "Felt scattered and slept badly",
  "openTaskCount": 8,
  "overdueTaskCount": 2,
  "todayScheduledTaskCount": 3,
  "todayScheduledEstimateMinutes": 110,
  "habitCountForDay": 4,
  "source": "coach"
}
```

Notes:

- keep this intentionally small in v1
- do not try to save the full world state
- if energy is later added as a structured field, include it here

### 3. Add `task_day_events`

Create a new table to log how the user's day changes after planning.

Suggested fields:

- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL`
- `task_id UUID NOT NULL`
- `date DATE NOT NULL`
- `plan_id UUID NULL`
- `actor TEXT NOT NULL`
  - `coach | user | system`
- `channel TEXT NOT NULL`
  - `chat | tasks_ui | system`
- `event_type TEXT NOT NULL`
  - `scheduled | rescheduled | unscheduled | completed | canceled | reopened | added_to_today | removed_from_today`
- `from_status TEXT NULL`
- `to_status TEXT NULL`
- `from_scheduled_date DATE NULL`
- `to_scheduled_date DATE NULL`
- `from_scheduled_time TEXT NULL`
- `to_scheduled_time TEXT NULL`
- `reason_code TEXT NULL`
- `reason_note TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Purpose:

- reconstruct what the coach proposed
- measure how much the user edited the day
- learn from reschedules, cancellations, and completions
- separate plan quality from day volatility

### 4. Extend memories for behavior-derived learning

Current memories are chat-derived. Extend them so some memories can come from observed behavior.

Suggested additions to `memories`:

- `source_type TEXT NOT NULL DEFAULT 'chat'`
  - `chat | behavior`
- `confidence NUMERIC NULL`

Purpose:

- keep one durable-memory system
- let the coach use stable behavioral lessons without adding another visible product concept

Examples:

- `Usually completes 2 meaningful tasks on weekdays`
- `Often moves admin tasks out of the morning`
- `Low-mood days work better with a lighter plan`

## Coach Input Model

Before generating a plan, the coach should receive a compact planning packet instead of raw history dumps.

### Required inputs for v1

- open tasks
- tasks already scheduled for the selected day
- overdue tasks
- active habits
- recent habit completion signal
- last 3-7 recent journal entries
- active accepted daily plan for the selected day, if any
- recent task-day event summary for the last 7-14 days
- top 3-5 relevant memories

### Event summary should answer

- how many planned tasks were completed
- how many were deferred
- how many were canceled
- how many new tasks were manually added to today
- what scheduled times tend to succeed or fail

The coach should not ingest the full raw event log every time.

## Plan Output Rules

The accepted daily plan should stay lightweight.

### Plan structure

- one short rationale
- task items tied to real `todo` records
- habit items tied to real `habit` records
- optional note items only when helpful
- concrete `scheduledTime` values for every planned item
- clear optional vs non-optional distinction

### Important invariant

If a plan includes a task for today:

- that task must also exist as a real scheduled task on the selected date

This keeps `Coach` and `Tasks` aligned.

## UI Direction

### Tasks screen

Move the primary day-management experience into Tasks.

Target sections:

- `Today`
  - tasks scheduled for the selected date
- `Completed`
- `Unscheduled`
- `Overdue` when relevant

Expected user actions:

- add to today
- mark done
- cancel
- reschedule
- edit

Each of those actions should:

- update `todos`
- update active daily plan outcome if relevant
- create a `task_day_events` entry

### Coach screen

The Coach should:

- propose task scheduling decisions
- explain why the day looks the way it does
- offer replanning when the day changes

It should not own a separate hidden task list.

### Habits screen

Keep habits simple in v1. Do not over-model them.

Needed fields:

- name
- frequency
- preferred time of day
- optional reason

Useful later, but not required in the first pass:

- minimum version
- flexibility
- trigger

### Journal

Keep journal lightweight.

For v1:

- freeform text
- mood

Optional future addition:

- structured energy field

Do not add a large check-in flow yet. If needed, the coach can ask one lightweight clarifying question in chat.

## Rollout Plan

### Phase 1. Product simplification

Goal:

- make tasks, habits, and journal the only visible product pillars

Work:

- remove `Today` from bottom nav
- move day focus fully into Tasks
- stop treating goals as part of the main planning loop
- update coach framing and UI copy to use tasks, habits, and journal only

Exit criteria:

- the main navigation reflects the simplified product shape
- coach flows no longer depend on goals

### Phase 2. Unify day state around tasks

Goal:

- ensure task scheduling is canonical

Work:

- confirm all planned tasks become scheduled todos for that day
- confirm all task UI edits update the same underlying task records
- make sure accepted coach proposals always write real task changes before or with plan save

Exit criteria:

- no task exists only inside a daily plan
- `Tasks > Today` reflects accepted coach planning decisions

### Phase 3. Add day context snapshots

Goal:

- preserve planning context at accept time

Work:

- add `context_snapshot` to `daily_plans`
- generate the snapshot when saving an accepted plan
- include only compact high-signal fields

Exit criteria:

- every accepted plan stores the conditions under which it was made

### Phase 4. Add task event logging

Goal:

- capture how the day changes

Work:

- add `task_day_events`
- create service helpers for event writes
- log coach-scheduled changes
- log task UI changes: complete, cancel, reschedule, unschedule, manual add-to-today

Exit criteria:

- every meaningful day-shaping task action creates an event entry

### Phase 5. Feed behavior back into planning

Goal:

- make the coach adapt to execution patterns

Work:

- build a compact summary function over recent event history
- extend memory extraction or add a lightweight behavior-to-memory job
- store only durable high-confidence lessons
- include behavior memories and recent event summary in coach context

Exit criteria:

- the coach uses behavior-derived signals in addition to chat-derived memories

### Phase 6. Replanning loop

Goal:

- make it feel seamless to move between coach and UI

Work:

- if the user changes planned tasks manually, make that visible in the active plan state
- allow the coach to replan from the updated day without losing continuity
- track parent/child plan versions through `parent_plan_id`

Exit criteria:

- users can accept a plan, change it through the UI, and continue with the coach naturally

## Immediate Build Order

This is the recommended order to start implementation now.

1. Remove `Today` from the main nav and reposition day management into Tasks.
2. Remove goals from the main planning loop and coach framing.
3. Add `context_snapshot` to `daily_plans`.
4. Add `task_day_events`.
5. Log task changes from the Tasks screen and coach proposal application flow.
6. Build a recent event summary helper for coach requests.
7. Extend memories to support `behavior` sources.
8. Update the coach prompt and request payload to use the new planning packet.

## Implementation Notes By Layer

### Shared types

Update [packages/shared/src/types/index.ts](../packages/shared/src/types/index.ts) to:

- make goals clearly optional or removable from the main coach contract
- add task event types
- add daily plan context snapshot types
- add memory source metadata

### Mobile app

Likely files to touch:

- [apps/mobile/app/(tabs)/_layout.tsx](../apps/mobile/app/(tabs)/_layout.tsx)
- [apps/mobile/app/(tabs)/tasks.tsx](../apps/mobile/app/(tabs)/tasks.tsx)
- [apps/mobile/app/(tabs)/today.tsx](../apps/mobile/app/(tabs)/today.tsx)
- [apps/mobile/app/session.tsx](../apps/mobile/app/session.tsx)
- [apps/mobile/utils/applyCoachProposal.ts](../apps/mobile/utils/applyCoachProposal.ts)
- task and daily-plan stores/services

### API

Likely files to touch:

- [apps/api/src/services/openai.ts](../apps/api/src/services/openai.ts)
- chat request assembly paths
- future behavior summarization helpers

### Supabase

Likely work:

- new migration for `daily_plans.context_snapshot`
- new migration for `task_day_events`
- possible migration for `memories.source_type` and `memories.confidence`

## Out of Scope For V1

- goals as a core planning primitive
- a separate user-facing planning settings area
- a rich analytics dashboard
- a large structured daily check-in flow
- advanced habit modeling such as triggers, flexibility rules, or habit templates
- a separate `planning_insights` product surface

## Success Criteria

We should consider the first version successful if:

- users can plan the day from chat
- accepted plan tasks show up in `Tasks > Today`
- users can reshape the day from the UI without confusing the coach
- the system logs enough behavior to improve future planning
- the visible product still feels like a simple tasks + habits + journal app
