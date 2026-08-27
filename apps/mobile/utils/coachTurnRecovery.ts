import type { CoachTurnRecord } from '@habits-coach/shared';

/** How often to ask the server whether the turn has finished. */
const POLL_MS = 2_000;
/**
 * Six minutes of polling: a minute past the server's own cap on a turn
 * (`config.coach.turnCapMs` in the API), so its verdict — reply or failure —
 * always lands before we give up.
 */
const MAX_POLLS = (6 * 60_000) / POLL_MS;

type FinishedTurn = Exclude<CoachTurnRecord, { status: 'running' }>;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Polls the server's record of the session's turn until it ends. The slot holds
 * one turn, so the record has to be *this* turn's: it is matched by the prompt
 * the server trimmed and stored. The first ask is immediate — the turn has often
 * finished while the app was suspended — and a failed poll (no network yet, on
 * the way back from the background) is just another wait. Resolves null once
 * the cap is spent.
 */
export async function waitForTurn(
  prompt: string,
  load: () => Promise<CoachTurnRecord | null>,
  sleep: (ms: number) => Promise<void> = realSleep
): Promise<FinishedTurn | null> {
  const wanted = prompt.trim();
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    if (poll > 0) await sleep(POLL_MS);
    const record = await load().catch(() => null);
    if (record && record.prompt === wanted && record.status !== 'running') return record;
  }
  return null;
}
