/**
 * Hold-to-instruct: the state behind holding the Coach tab, the proposal
 * sheet it produces, and the correction/apply turns that follow. Pure, so the
 * transitions are testable without a recorder or a network.
 */

/** How long the Coach tab must be held before recording starts. */
export const HOLD_MS = 400;
/** Sliding the finger this far above where the hold began arms cancel. */
export const CANCEL_LIFT = 64;
export const TOAST_MS = 1600;

export const NOTHING_HEARD = "Didn't catch that. Hold Coach and try again.";
export const NOTHING_TO_DO = 'Nothing to change.';

interface Proposal {
  summary: string;
  actions: string[];
}

type InstructPhase =
  | 'idle'
  | 'recording'
  | 'working'
  | 'proposal'
  | 'notice'
  | 'applying'
  | 'toast';

export interface InstructState {
  phase: InstructPhase;
  /** The hold began over a sheet whose session can be resumed: the result revises it. */
  correcting: boolean;
  cancelArmed: boolean;
  /** What the coach is doing right now (a tool label) while working or applying. */
  activity: string | null;
  /** The transcript the sheet quotes. */
  transcript: string | null;
  proposal: Proposal | null;
  /** The Agent SDK session a correction or apply resumes. */
  claudeSessionId: string | null;
  revised: boolean;
  /** A question, "nothing to do", or an error — shown instead of, or under, a proposal. */
  notice: string | null;
  toast: string | null;
}

export const INITIAL_INSTRUCT_STATE: InstructState = {
  phase: 'idle',
  correcting: false,
  cancelArmed: false,
  activity: null,
  transcript: null,
  proposal: null,
  claudeSessionId: null,
  revised: false,
  notice: null,
  toast: null,
};

export type InstructAction =
  | { type: 'hold-start' }
  | { type: 'hold-move'; lift: number }
  | { type: 'hold-cancel' }
  | { type: 'abort' }
  | { type: 'submit' }
  | { type: 'nothing-heard' }
  | { type: 'session'; claudeSessionId: string }
  | { type: 'activity'; label: string }
  | { type: 'proposal'; transcript: string; proposal: Proposal }
  | { type: 'notice'; message: string; transcript?: string }
  | { type: 'apply' }
  | { type: 'applied' }
  | { type: 'dismiss' }
  | { type: 'toast-expired' };

/** The one place the cancel line is drawn: the outcome and the hint agree by construction. */
function armed(lift: number): boolean {
  return lift > CANCEL_LIFT;
}

/**
 * What a finished hold means. The lift is measured by the gesture itself, so
 * this never depends on state React has not rendered yet: a flick up and
 * release is a cancel even when the arming dispatch has not flushed.
 */
export function holdOutcome(released: boolean, lift: number): 'submit' | 'cancel' {
  return released && !armed(lift) ? 'submit' : 'cancel';
}

/** Only a working turn can be stopped: applying is already writing real data. */
export function canAbort(state: InstructState): boolean {
  return state.phase === 'working';
}

/** Whether a hold may begin: nothing is being recorded or run. */
export function canHold(state: InstructState): boolean {
  return (
    state.phase === 'idle' ||
    state.phase === 'proposal' ||
    state.phase === 'notice' ||
    state.phase === 'toast'
  );
}

/** The sheet a hold interrupted, to return to when that hold is cancelled. */
function sheetPhase(state: InstructState): InstructPhase {
  if (state.proposal) return 'proposal';
  if (state.notice) return 'notice';
  return 'idle';
}

export function formatApplied(count: number): string {
  if (count === 0) return 'Applied';
  return `Applied · ${count} change${count === 1 ? '' : 's'}`;
}

export function instructReducer(state: InstructState, action: InstructAction): InstructState {
  switch (action.type) {
    case 'hold-start':
      if (!canHold(state)) return state;
      return {
        ...state,
        phase: 'recording',
        correcting: state.claudeSessionId !== null,
        cancelArmed: false,
        activity: null,
        toast: null,
      };

    case 'hold-move': {
      if (state.phase !== 'recording') return state;
      const cancelArmed = armed(action.lift);
      return cancelArmed === state.cancelArmed ? state : { ...state, cancelArmed };
    }

    case 'hold-cancel':
      if (state.phase !== 'recording') return state;
      if (!state.correcting) return INITIAL_INSTRUCT_STATE;
      return { ...state, phase: sheetPhase(state), correcting: false, cancelArmed: false };

    case 'abort': {
      if (!canAbort(state)) return state;
      const phase = sheetPhase(state);
      if (phase === 'idle') return INITIAL_INSTRUCT_STATE;
      return { ...state, phase, correcting: false, activity: null };
    }

    case 'submit':
      if (state.phase !== 'recording') return state;
      return { ...state, phase: 'working', cancelArmed: false, activity: null };

    case 'nothing-heard':
      if (state.phase !== 'working') return state;
      if (state.correcting && state.proposal) {
        return { ...state, phase: 'proposal', correcting: false, notice: NOTHING_HEARD };
      }
      return { ...state, phase: 'notice', correcting: false, proposal: null, notice: NOTHING_HEARD };

    case 'session':
      return { ...state, claudeSessionId: action.claudeSessionId };

    case 'activity':
      if (state.phase !== 'working' && state.phase !== 'applying') return state;
      return { ...state, activity: action.label };

    case 'proposal':
      if (state.phase !== 'working') return state;
      return {
        ...state,
        phase: 'proposal',
        proposal: action.proposal,
        transcript: action.transcript,
        revised: state.correcting && state.proposal !== null,
        correcting: false,
        activity: null,
        notice: null,
      };

    case 'notice':
      if (state.phase !== 'working' && state.phase !== 'applying') return state;
      return {
        ...state,
        phase: 'notice',
        notice: action.message,
        transcript: action.transcript ?? state.transcript,
        proposal: null,
        revised: false,
        correcting: false,
        activity: null,
      };

    case 'apply':
      if (state.phase !== 'proposal' || !state.proposal) return state;
      return { ...state, phase: 'applying', activity: null, notice: null };

    case 'applied':
      if (state.phase !== 'applying') return state;
      return {
        ...INITIAL_INSTRUCT_STATE,
        phase: 'toast',
        toast: formatApplied(state.proposal?.actions.length ?? 0),
      };

    case 'dismiss':
      if (state.phase === 'recording' || state.phase === 'working' || state.phase === 'applying') return state;
      return INITIAL_INSTRUCT_STATE;

    case 'toast-expired':
      return state.phase === 'toast' ? INITIAL_INSTRUCT_STATE : state;
  }
}

export type ProposalOutcome =
  | { kind: 'proposal'; proposal: Proposal }
  | { kind: 'notice'; message: string };

const BULLET = /^[-•*]\s+/;

function plain(line: string): string {
  return line.replace(/\*\*/g, '').trim();
}

/**
 * Reads the `instruct` skill's reply: a summary line followed by one `- `
 * bullet per change; `NOTHING: <reason>` when there is nothing to do; or a
 * bare question when the coach needs an answer first.
 */
export function parseProposal(text: string): ProposalOutcome {
  const lines = text
    .split('\n')
    .map(plain)
    .filter((line) => line.length > 0 && !/^```/.test(line));
  if (lines.length === 0) return { kind: 'notice', message: NOTHING_TO_DO };

  const nothing = /^NOTHING:?\s*(.*)$/i.exec(lines[0]);
  if (nothing) return { kind: 'notice', message: nothing[1] || NOTHING_TO_DO };

  const actions = lines.filter((line) => BULLET.test(line)).map((line) => line.replace(BULLET, ''));
  if (actions.length === 0) return { kind: 'notice', message: lines.join(' ') };

  const summary =
    lines.find((line) => !BULLET.test(line)) ?? `${actions.length} change${actions.length === 1 ? '' : 's'}`;
  return { kind: 'proposal', proposal: { summary, actions } };
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** What the capture panel tells the finger to do next. */
export function holdHint(state: InstructState): string {
  if (state.cancelArmed) return 'Release to discard';
  if (state.correcting) return 'Release to revise · Slide up to cancel';
  return 'Release to send · Slide up to cancel';
}

/** What the sheet's footer invites while a sheet is up. */
export function sheetHint(state: InstructState): string {
  if (state.phase === 'proposal') return 'Hold Coach to correct it';
  return state.claudeSessionId ? 'Hold Coach to reply' : 'Hold Coach to try again';
}

export function workingLabel(state: InstructState): string {
  if (state.activity) return state.activity;
  return state.correcting ? 'Revising…' : 'Working on it…';
}
