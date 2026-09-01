/**
 * Runs one coaching turn against the test account and prints the stream.
 *
 *   pnpm --filter @habits-coach/api coach:smoke [prompt]   (default: /coach)
 *
 * Needs apps/api/.env (Supabase + CLAUDE_CODE_OAUTH_TOKEN or a local Claude login)
 * and COACH_SMOKE_USER_ID (defaults to the account TEST_USER_EMAIL names,
 * looked up by email so a --db worktree's own copy resolves too).
 *
 * COACH_SMOKE_MODE=instruct runs the turn the way the instruct queue does:
 * only the `instruct` skill, write tools live, one act turn — pass the
 * spoken instruction as `/instruct <text>`.
 */
import { INSTRUCT_SKILLS, runCoachTurn } from '../src/coach/agent.js';
import { resolveTestUserId } from './seed/test-user.js';

const userId = process.env.COACH_SMOKE_USER_ID || (await resolveTestUserId());
const prompt = process.argv.slice(2).join(' ') || '/coach';
const claudeSessionId = process.env.COACH_SMOKE_RESUME || null;
const instruct = process.env.COACH_SMOKE_MODE === 'instruct';

const started = Date.now();
const result = await runCoachTurn(
  {
    userId,
    prompt,
    timezone: process.env.HABITRON_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    userName: 'Test',
    claudeSessionId,
    ...(instruct ? { skills: INSTRUCT_SKILLS, readOnly: false } : {}),
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
if (result.writeToolCalls.length > 0) {
  console.error('Recorded write calls:', JSON.stringify(result.writeToolCalls, null, 2));
}
console.error('Resume with: COACH_SMOKE_RESUME=' + result.claudeSessionId);
