/**
 * Hold-to-instruct: the state behind holding the Coach tab. Fire-and-forget
 * (HAB-134): release uploads and enqueues, and everything after release is
 * server state the app re-derives from the activity log. Pure, so the
 * transitions are testable without a recorder or a network.
 */

import type { InstructActionRow } from '@habits-coach/shared';

/** How long the Coach tab must be held before recording starts. */
export const HOLD_MS = 400;
/** Sliding the finger this far above where the hold began arms cancel. */
const CANCEL_LIFT = 64;

export const NOTHING_HEARD = "Didn't catch that. Hold Coach and try again.";
export const UPLOAD_FAILED = "Couldn't send. Hold Coach and try again.";

type InstructPhase = 'idle' | 'recording';

export interface InstructState {
  phase: InstructPhase;
  cancelArmed: boolean;
}

export const INITIAL_INSTRUCT_STATE: InstructState = {
  phase: 'idle',
  cancelArmed: false,
};

export type InstructAction =
  | { type: 'hold-start' }
  | { type: 'hold-move'; lift: number }
  | { type: 'hold-cancel' }
  | { type: 'submit' };

/** Where the cancel line is drawn. Only `hold-move` calls it; everything else reads `cancelArmed`. */
function armed(lift: number): boolean {
  return lift > CANCEL_LIFT;
}

/**
 * What a finished hold means, read from the state the gesture has been feeding.
 *
 * `cancelArmed` is safe to trust here only because the provider advances its
 * ref through this reducer at dispatch time: the `hold-move` that armed the
 * cancel is already applied when the release asks, without waiting on a render.
 */
export function holdOutcome(released: boolean, state: InstructState): 'submit' | 'cancel' {
  return released && !state.cancelArmed ? 'submit' : 'cancel';
}

/** Whether a hold may begin: nothing is being recorded. */
export function canHold(state: InstructState): boolean {
  return state.phase === 'idle';
}

export function instructReducer(state: InstructState, action: InstructAction): InstructState {
  switch (action.type) {
    case 'hold-start':
      if (!canHold(state)) return state;
      return { phase: 'recording', cancelArmed: false };

    case 'hold-move': {
      if (state.phase !== 'recording') return state;
      const cancelArmed = armed(action.lift);
      return cancelArmed === state.cancelArmed ? state : { ...state, cancelArmed };
    }

    case 'hold-cancel':
    case 'submit':
      // Release is the end of the gesture either way: the upload (on submit)
      // belongs to the queue store, not to this state.
      if (state.phase !== 'recording') return state;
      return INITIAL_INSTRUCT_STATE;
  }
}

/**
 * The id the client gives an instruction before uploading it, so a reply lost
 * with the connection can still be looked up in the log. React Native has no
 * `crypto.randomUUID`, and this is an idempotency key for one user's own queue,
 * not a secret, so `Math.random` is enough to shape a v4.
 */
export function newActionId(): string {
  const hex = (digits: number) =>
    Math.floor(Math.random() * 16 ** digits)
      .toString(16)
      .padStart(digits, '0');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16); // 8, 9, a or b
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** What the capture panel tells the finger to do next. */
export function holdHint(state: InstructState, reinstructing: boolean): string {
  if (state.cancelArmed) return 'Release to discard';
  if (reinstructing) return 'Release to re-instruct · Slide up to cancel';
  return 'Release to send · Slide up to cancel';
}

// --- Reading the activity log -----------------------------------------------

/** Statuses the queue is still going to act on. */
function isPending(action: InstructActionRow): boolean {
  return action.status === 'queued' || action.status === 'working';
}

/** The item the pill's spinner narrates: the working one, else the oldest queued. */
export function currentAction(actions: InstructActionRow[]): InstructActionRow | null {
  const pending = actions.filter(isPending);
  return pending.find((action) => action.status === 'working') ?? pending[pending.length - 1] ?? null;
}

/** The row's one-line title, by status — what both the pill and the sheet show. */
export function actionTitle(action: InstructActionRow): string {
  if (action.status === 'failed') return action.error ?? 'Something went wrong';
  if (action.status === 'queued' || action.status === 'working') {
    return action.summary ?? `“${action.transcript}”`;
  }
  return firstLine(action.result) ?? action.summary ?? `“${action.transcript}”`;
}

function firstLine(text: string | null): string | null {
  const line = text?.split('\n', 1)[0]?.trim();
  return line || null;
}

export interface QueueCounts {
  /** Still queued or working. */
  pending: number;
  /** Failures not yet retried or dismissed — these keep the pill on screen. */
  failed: number;
}

export function queueCounts(actions: InstructActionRow[]): QueueCounts {
  return {
    pending: actions.filter(isPending).length,
    failed: actions.filter((action) => action.status === 'failed').length,
  };
}
