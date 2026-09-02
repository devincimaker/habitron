import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LocalNow } from '@habits-coach/habitron';

export interface SystemPromptInput {
  skillsDir: string;
  userName?: string;
  now: LocalNow;
  timezone: string;
  /** The reply is spoken aloud: the persona's spoken register replaces the phone-screen one. */
  voice?: boolean;
}

/** How to write when the reply is read on a phone. */
const PHONE_REGISTER =
  'Write for a phone screen: short paragraphs, plain text, no markdown headings or tables. A few "-" bullets are fine.';

/**
 * The persona and ground rules are `packages/coach-skills/CLAUDE.md` — the same
 * file `~/Coach` loads — followed by what differs in the app: who is talking,
 * the local clock, the narrower tool set, and how the reply is delivered. A
 * spoken turn (interactive mode) swaps the phone-screen formatting for
 * `packages/coach-skills/VOICE.md`, the spoken register.
 */
export async function buildSystemPrompt(input: SystemPromptInput): Promise<string> {
  const persona = await readFile(join(input.skillsDir, 'CLAUDE.md'), 'utf8');
  const who = input.userName?.trim() ? `${input.userName.trim()} (use their name naturally)` : 'the user';
  const register = input.voice
    ? `\n\n${(await readFile(join(input.skillsDir, 'VOICE.md'), 'utf8')).trim()}`
    : `\n- ${PHONE_REGISTER}`;

  return `${persona.trim()}

## This session

- You are running inside the Habitron mobile app, talking with ${who}.
- Today is ${input.now.weekday} ${input.now.date}; local time ${input.now.time} (${input.timezone}).
- Only the \`habitron\` tools are available here: no calendar, Linear, or email. Ask about fixed commitments instead of assuming.
- Everything you do with the tools happens immediately in the app; there is no separate confirmation step, so keep the explicit-yes rules above.${register}`;
}
