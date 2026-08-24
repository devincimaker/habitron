# coach-skills

The single source of truth for coaching behavior (HAB-72). `CLAUDE.md` is the persona, ground rules, and skill index; `.claude/skills/<name>/SKILL.md` are the skills. Plain markdown, no build step, no package.json — these are prompts, not code.

Editing a file here changes every coaching surface:

- **Claude Code (`~/Coach`)** — `~/Coach/CLAUDE.md` is a symlink to `CLAUDE.md`, and `~/Coach/.claude/skills/<name>` are symlinks to the skill folders here. Author and iterate in Claude Code as usual; git owns history.
- **In-app coach (`apps/api`)** — the Agent SDK runs with this folder as its working directory, so it discovers the same `.claude/skills`, and `CLAUDE.md` is loaded as its system prompt (plus a short app-specific section: who is talking, the local clock, phone formatting).

Note: Claude Code's CLAUDE.md loader and skills loader follow symlinks; the `@`-import resolver does not — that's why the whole file is symlinked rather than imported.
