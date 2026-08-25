/**
 * Runs one coaching turn against the test account and prints the stream.
 *
 *   pnpm --filter @habits-coach/api coach:smoke [prompt]   (default: /coach)
 *
 * Needs apps/api/.env (Supabase + CLAUDE_CODE_OAUTH_TOKEN or a local Claude login)
 * and COACH_SMOKE_USER_ID (defaults to the simulator test account).
 */
import { runCoachTurn } from '../src/coach/agent.js';

const userId = process.env.COACH_SMOKE_USER_ID || 'f59b2da9-c260-4930-bf50-686eb9c2d1e5';
const prompt = process.argv.slice(2).join(' ') || '/coach';
const claudeSessionId = process.env.COACH_SMOKE_RESUME || null;

const started = Date.now();
const result = await runCoachTurn(
  {
    userId,
    prompt,
    timezone: process.env.HABITRON_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    userName: 'Test',
    claudeSessionId,
  },
  (event) => {
    if (event.type === 'text') {
      process.stdout.write(event.delta);
    } else if (event.type === 'done') {
      process.stdout.write('\n');
    } else {
      console.error(`\n[${event.type}]`, JSON.stringify(event));
    }
  }
);

console.error(`\n--- ${Math.round((Date.now() - started) / 1000)}s, claude session ${result.claudeSessionId}`);
console.error('Resume with: COACH_SMOKE_RESUME=' + result.claudeSessionId);
