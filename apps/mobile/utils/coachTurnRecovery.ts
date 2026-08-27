import type { CoachTurnRecord } from '@habits-coach/shared';

/** How often to ask the server whether the turn has finished. */
const TURN_RECOVERY_POLL_MS = 2_000;
/** Matches the server's cap on a turn that outlived its client. */
const TURN_RECOVERY_CAP_MS = 5 * 60_000;
export const RECONNECTING_MESSAGE = 'Reconnecting to the coach…';
export const TURN_LOST_MESSAGE = "I lost the coach's reply. Please try again.";

/** The record for `prompt` once it has ended; null while it still runs or when it belongs to another turn. */
export function finishedTurn(record: CoachTurnRecord | null, prompt: string): CoachTurnRecord | null {
  if (!record || record.prompt !== prompt.trim() || record.status === 'running') return null;
  return record;
}

interface WaitOptions {
  pollMs?: number;
  capMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Polls the server's record of this turn until it ends. A failed poll (no
 * network yet, on the way back from the background) is just another wait.
 * Resolves null once the cap is spent.
 */
export async function waitForTurn(
  load: () => Promise<CoachTurnRecord | null>,
  prompt: string,
  { pollMs = TURN_RECOVERY_POLL_MS, capMs = TURN_RECOVERY_CAP_MS, sleep = realSleep }: WaitOptions = {}
): Promise<CoachTurnRecord | null> {
  for (let elapsed = 0; elapsed <= capMs; elapsed += pollMs) {
    const record = await load().catch(() => null);
    const finished = finishedTurn(record, prompt);
    if (finished) return finished;
    await sleep(pollMs);
  }
  return null;
}
