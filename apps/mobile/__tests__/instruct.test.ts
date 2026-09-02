import type { InstructActionRow } from '@habits-coach/shared';
import {
  INITIAL_INSTRUCT_STATE,
  actionTitle,
  currentAction,
  formatElapsed,
  holdOutcome,
  instructReducer,
  newActionId,
  queueCounts,
  type InstructAction,
  type InstructState,
} from '../utils/instruct';

function run(...actions: InstructAction[]): InstructState {
  return actions.reduce(instructReducer, INITIAL_INSTRUCT_STATE);
}

function row(overrides: Partial<InstructActionRow>): InstructActionRow {
  return {
    id: 'a1',
    status: 'queued',
    transcript: 'move gym to 6pm',
    summary: null,
    result: null,
    error: null,
    createdAt: '2026-09-01T10:00:00Z',
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe('instructReducer', () => {
  it('records on hold and returns to idle on release', () => {
    const recording = run({ type: 'hold-start' });
    expect(recording.phase).toBe('recording');

    // Release fires and forgets: the upload belongs to the store, not this state.
    expect(run({ type: 'hold-start' }, { type: 'submit' })).toEqual(INITIAL_INSTRUCT_STATE);
  });

  it('arms cancel past the threshold, and disarms when the finger comes back', () => {
    const armed = run({ type: 'hold-start' }, { type: 'hold-move', lift: 80 });
    expect(armed.cancelArmed).toBe(true);

    const disarmed = instructReducer(armed, { type: 'hold-move', lift: 10 });
    expect(disarmed.cancelArmed).toBe(false);
  });

  it('cancelling a hold returns to idle', () => {
    expect(run({ type: 'hold-start' }, { type: 'hold-cancel' })).toEqual(INITIAL_INSTRUCT_STATE);
  });

  it('ignores gesture events outside a recording', () => {
    expect(run({ type: 'hold-move', lift: 100 })).toEqual(INITIAL_INSTRUCT_STATE);
    expect(run({ type: 'submit' })).toEqual(INITIAL_INSTRUCT_STATE);
    expect(run({ type: 'hold-start' }, { type: 'hold-start' }).phase).toBe('recording');
  });
});

describe('holdOutcome', () => {
  const recording = run({ type: 'hold-start' });

  it('submits a clean release that never rose past the cancel line', () => {
    expect(holdOutcome(true, recording)).toBe('submit');
  });

  it('cancels a release above the cancel line, however fast the flick', () => {
    const armed = instructReducer(recording, { type: 'hold-move', lift: 200 });
    expect(holdOutcome(true, armed)).toBe('cancel');
  });

  it('cancels a gesture that ended without a release', () => {
    expect(holdOutcome(false, recording)).toBe('cancel');
  });

  it('submits when the finger came back down before release', () => {
    const backDown = [
      { type: 'hold-move', lift: 200 } as const,
      { type: 'hold-move', lift: 0 } as const,
    ].reduce(instructReducer, recording);
    expect(holdOutcome(true, backDown)).toBe('submit');
  });
});

describe('reading the activity log', () => {
  it('titles a pending row with its working label, falling back to the transcript', () => {
    expect(actionTitle(row({ status: 'working', summary: "Moving 'Gym' to 6:00 PM…" }))).toBe(
      "Moving 'Gym' to 6:00 PM…"
    );
    expect(actionTitle(row({ status: 'queued' }))).toBe('“move gym to 6pm”');
  });

  it('titles an applied row with the first line of its result', () => {
    expect(actionTitle(row({ status: 'applied', result: "Moved 'Gym' to 6:00 PM\n- details" }))).toBe(
      "Moved 'Gym' to 6:00 PM"
    );
  });

  it('titles a failed row with its error', () => {
    expect(actionTitle(row({ status: 'failed', error: 'Which run — morning or evening?' }))).toBe(
      'Which run — morning or evening?'
    );
  });

  it('narrates the working item, else the oldest queued one', () => {
    const working = row({ id: 'w', status: 'working' });
    const oldest = row({ id: 'q1', createdAt: '2026-09-01T10:01:00Z' });
    const newest = row({ id: 'q2', createdAt: '2026-09-01T10:02:00Z' });

    expect(currentAction([newest, working, oldest])?.id).toBe('w');
    // Newest first, as the log arrives: the current item is the oldest queued.
    expect(currentAction([newest, oldest])?.id).toBe('q1');
    expect(currentAction([row({ status: 'applied' })])).toBeNull();
  });

  it('counts what is pending and what failed', () => {
    const counts = queueCounts([
      row({ id: '1', status: 'queued' }),
      row({ id: '2', status: 'working' }),
      row({ id: '3', status: 'failed' }),
      row({ id: '4', status: 'applied' }),
      row({ id: '5', status: 'canceled' }),
    ]);
    expect(counts).toEqual({ pending: 2, failed: 1 });
  });
});

describe('newActionId', () => {
  it('mints a v4 uuid the server will take as a row id', () => {
    expect(newActionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('never repeats itself', () => {
    const ids = new Set(Array.from({ length: 500 }, newActionId));
    expect(ids.size).toBe(500);
  });
});

describe('formatting', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(61_000)).toBe('1:01');
    expect(formatElapsed(600_000)).toBe('10:00');
  });
});
