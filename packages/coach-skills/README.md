# coach-skills

The single source of truth for coaching behavior (HAB-72 Part 1). One folder per skill, plain markdown, plus `COACH-CLAUDE.md` (persona + ground rules + skill index).

Editing a file here changes every coaching surface:

- **Claude Code (`~/Coach`)** — `~/Coach/CLAUDE.md` is a symlink to `COACH-CLAUDE.md`, and `~/Coach/.claude/skills/<name>` are symlinks to the skill folders here. Author and iterate in Claude Code as usual; git owns history.
- **In-app coach (HAB-72 Part 2, future)** — the Agent SDK in `apps/api` loads the same skill folders as its skills and `COACH-CLAUDE.md` as its system-prompt persona.

Note: Claude Code's CLAUDE.md loader and skills loader follow symlinks; the `@`-import resolver does not — that's why the whole file is symlinked rather than imported.

No build step, no package.json — these are prompts, not code.
