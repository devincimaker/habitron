# Coach Skill Map

Habitron should not act like one giant prompt. The coach should act like an orchestrator that routes user intent to specialized skills, while tools perform deterministic state reads and mutations.

## Core Model

Three layers:

1. Orchestrator
   Decides which skill should own the current turn.

2. Skills
   Specialized reasoning bundles, each with its own `SKILL.md` instructions, heuristics, and examples.

3. Tools
   Concrete app mutations and reads such as creating a task, editing a habit, saving a journal entry, or accepting a plan.

The rule is:

- if the problem needs judgment, interviewing, prioritization, reframing, or synthesis, it is a skill
- if the problem is a concrete side effect on application state, it is a tool

## Initial Skill Map

### Day Planning

Shape a day collaboratively, ask intake questions before drafting, draft a realistic plan, revise without losing continuity.

### Task Management

Capture, inspect, clean up, prioritize, and restructure tasks with grounded IDs.

### Habit Design

Create, expand, contract, and archive habits based on fit, not ambition.

## Routing Rules

- "Plan my day" -> `day-planning`
- "My day changed, help me replan" -> `day-planning`
- "I keep failing this habit" -> `habit-design`
- "I have twenty tasks and don't know where to start" -> `task-management`

## Implementation Standard

Use local skill bundles:

- each skill lives in its own folder
- each skill has a `SKILL.md`
- supporting examples or rubrics can be added later

The default prompt should remain a thin orchestrator. It should not include every skill body; the runtime loads only the active skill and compact persisted session state.
