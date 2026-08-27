import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EffortLevel } from '@anthropic-ai/claude-agent-sdk';

const here = dirname(fileURLToPath(import.meta.url));

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function optionalEffort(): EffortLevel | undefined {
  const value = process.env.COACH_EFFORT;
  if (!value) return undefined;
  if (!EFFORT_LEVELS.includes(value as EffortLevel)) {
    throw new Error(`COACH_EFFORT must be one of ${EFFORT_LEVELS.join(', ')}`);
  }
  return value as EffortLevel;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },
  /** Whisper transcription for voice input; the coach itself runs on Claude. */
  openai: {
    apiKey: required('OPENAI_API_KEY'),
  },
  coach: {
    model: process.env.COACH_MODEL || 'claude-opus-5',
    effort: optionalEffort(),
    /** Persona (`CLAUDE.md`) and skills (`.claude/skills/*`) shared with `~/Coach`. */
    skillsDir: resolve(here, '../../../packages/coach-skills'),
    /** Tool-use round trips a single coaching turn may take. */
    maxTurns: 40,
    /**
     * Wall clock a single turn may take. A coaching turn outlives its client
     * (the app reads the reply back after iOS suspends it), so this is what
     * stops an abandoned one. The app waits a little longer than this.
     */
    turnCapMs: 5 * 60_000,
  },
} as const;

if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
  console.warn(
    'CLAUDE_CODE_OAUTH_TOKEN is not set; the coach will fall back to the local Claude Code login (fine in dev, not on a server).'
  );
}
