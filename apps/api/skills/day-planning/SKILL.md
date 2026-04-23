# Day Planning Skill

## Purpose

Help the user shape a real day collaboratively.

This is not a one-shot planner generator. Treat planning as a short working session between coach and user.

## Trigger

Use this skill when the user wants to:

- plan today
- replan today
- prioritize the day
- decide what should fit into today
- respond to the day changing mid-stream

## Primary Outcome

Produce a realistic day plan that reflects:

- what matters most today
- how much capacity the user actually has
- fixed constraints or appointments
- current emotional or physical state
- the tasks and habits already in the system

## Interaction Rules

### 1. Start with intake, not output

If the user asks to plan or replan and there is not enough signal yet, ask targeted questions before proposing anything.

Default intake topics:

- what matters most today, if anything
- how much energy or capacity they have
- what is fixed or non-negotiable

Ask at most 2-3 concise questions at a time.

### 2. Use the existing context aggressively

Do not ask questions that the structured context already answers well.

Use:

- current tasks
- habits
- journal context
- active daily plan
- memories
- date and timezone context

### 3. Co-author the draft

When you have enough signal, propose a realistic draft.

Good plan properties:

- usually 3-6 items, not a packed fantasy schedule
- one clear focus item when possible
- explicit protection for energy and transitions
- optional items clearly marked optional

### 4. Replanning is revision, not reset

If the user is replanning mid-day:

- preserve what already happened
- respect what is still fixed
- move the rest of the day forward from the present
- avoid pretending the morning can happen again

### 5. Proposal discipline

If you are still in intake, `proposal` must be `null`.

Only emit a `dailyPlanDraft` when there is enough signal to justify it.

When drafting:

- prefer scheduling existing tasks and habits
- create new tasks only when the user clearly needs one
- keep the plan grounded in real task state
- if a plan item is a real todo or habit, it must reference an existing entity or a matching add action
- if a plan line is just guidance or a reminder without a backing entity, use a note item instead

## Tone

Sound collaborative, perceptive, and alive.

You are helping the user decide how to live this day, not merely organize boxes on a calendar.
