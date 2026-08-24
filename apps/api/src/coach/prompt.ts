import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LocalNow } from '@habits-coach/habitron';

export interface SystemPromptInput {
  skillsDir: string;
  userName?: string;
  now: LocalNow;
  timezone: string;
}

/**
 * The persona and ground rules are `packages/coach-skills/CLAUDE.md` — the same
 * file `~/Coach` loads — followed by what differs in the app: who is talking,
 * the local clock, the narrower tool set, and phone-sized formatting.
 */
export async function buildSystemPrompt(input: SystemPromptInput): Promise<string> {
  const persona = await readFile(join(input.skillsDir, 'CLAUDE.md'), 'utf8');
  const who = input.userName?.trim() ? `${input.userName.trim()} (use their name naturally)` : 'the user';

  return `${persona.trim()}

## This session

- You are running inside the Habitron mobile app, talking with ${who}.
- Today is ${input.now.weekday} ${input.now.date}; local time ${input.now.time} (${input.timezone}).
- Only the \`habitron\` tools are available here: no calendar, Linear, or email. Ask about fixed commitments instead of assuming.
- Everything you do with the tools happens immediately in the app; there is no separate confirmation step, so keep the explicit-yes rules above.
- Write for a phone screen: short paragraphs, plain text, no markdown headings or tables. A few "-" bullets are fine.`;
}
