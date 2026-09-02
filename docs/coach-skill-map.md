# Coach architecture

One coach, authored in Claude Code, used anywhere.

## Layers

1. **Persona and skills** — `packages/coach-skills`. `CLAUDE.md` carries the ground rules (charity, encouraging-not-snarky, tags-as-categories, explicit yes before saving a plan, memory discipline) and the skill index; `.claude/skills/<name>/SKILL.md` are the skills: `coach` (open check-in that routes), `first-session`, `plan-day`, `review-day`, `review-habits`, `review-goals`. Judgment, interviewing, prioritising, and synthesis live here.

2. **Tools** — `packages/habitron`. One function per concrete read or mutation (`src/db.ts`), the compact day packet (`src/context.ts`), history and stats (`src/history.ts`), and the host-agnostic tool list with zod schemas (`src/tools.ts`). Deterministic state, no coaching opinions.

3. **Hosts** — where the model runs the loop.
   - `apps/mcp`: stdio MCP server for Claude Code (`~/Coach`), where calendar, Linear, and email tools can sit next to the Habitron ones.
   - `apps/api`: the Claude Agent SDK in-process. `src/coach/agent.ts` runs one turn with `cwd = packages/coach-skills` (so the skills are discovered exactly as Claude Code discovers them), `CLAUDE.md` as the system prompt, and the Habitron tools on an in-process MCP server. `src/coach/events.ts` turns the SDK stream into the events the app renders; `src/routes/chat.ts` streams them as server-sent events. The Agent SDK session id is stored on `coaching_sessions.claude_session_id`, so every turn resumes the coach's own transcript.

## Routing

The `coach` skill is the orchestrator: it loads context, checks in with one grounded question, and routes by intent into the other skills. In the app, a new session opens with `/coach`, or with a ritual's own skill from its card (`/plan-day`, `/review-day` on the hub; `/review-goals` on the Goals screen); the user's messages then flow through the same loop. There is no proposal/confirm protocol — the skills' own rules (explicit yes before `save_day_plan`, ask before `create_tag`, confirm before anything destructive) are the confirmation step, and the app refreshes its stores after each turn.

## Rules of thumb

- If it needs judgment, it is skill text. If it is a side effect on application state, it is a tool.
- Edit skills in `packages/coach-skills`; both surfaces change. `~/Coach` is symlinks.
- Add a tool in `packages/habitron/src/tools.ts`; both hosts pick it up. A tool that belongs to a module (`module: 'goals'`) is dropped from the list when Profile has that module off; `createHabitron` reads `user_profiles.disabled_modules` once, and `apps/api` drops the module's skill the same way.
