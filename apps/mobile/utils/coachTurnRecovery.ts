import type { CoachTurnRecord } from '@habits-coach/shared';

/** How often to ask the server whether the turn has finished. */
const POLL_MS = 2_000;
/**
 * A minute past the server's own cap on a turn (`config.coach.turnCapMs` in
 * the API), so its verdict — reply or failure — always lands before we give up.
 */
const CAP_MS = 6 * 60_000;
export const RECONNECTING_MESSAGE = 'Reconnecting to the coach…';

export type FinishedTurn = Exclude<CoachTurnRecord, { status: 'running' }>;

interface WaitOptions {
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Polls the server's record of the session's turn until it ends. The record
 * was written before the stream that just dropped ever opened, so it is this
 * turn's. A failed poll (no network yet, on the way back from the background)
 * is just another wait. Resolves null once the cap is spent.
 */
export async function waitForTurn(
  load: () => Promise<CoachTurnRecord | null>,
  { sleep = realSleep }: WaitOptions = {}
): Promise<FinishedTurn | null> {
  for (let elapsed = POLL_MS; elapsed <= CAP_MS; elapsed += POLL_MS) {
    await sleep(POLL_MS);
    const record = await load().catch(() => null);
    if (record && record.status !== 'running') return record;
  }
  return null;
}
