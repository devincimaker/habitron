import {
  CANCEL_LIFT,
  INITIAL_INSTRUCT_STATE,
  NOTHING_HEARD,
  NOTHING_TO_DO,
  canHold,
  formatApplied,
  formatElapsed,
  holdHint,
  holdOutcome,
  instructReducer,
  parseProposal,
  sheetHint,
  workingLabel,
  type InstructAction,
  type InstructState,
} from '../utils/instruct';

function run(actions: InstructAction[], from: InstructState = INITIAL_INSTRUCT_STATE): InstructState {
  return actions.reduce(instructReducer, from);
}

const proposal = { summary: 'Reschedule one task, add another', actions: ['Move Evening run to tomorrow', 'Add Buy oat milk'] };

const proposed = run([
  { type: 'hold-start' },
  { type: 'submit' },
  { type: 'session', claudeSessionId: 'claude-1' },
  { type: 'proposal', transcript: 'move my run', proposal },
]);

describe('instructReducer', () => {
  it('records on hold and works on release', () => {
    const recording = run([{ type: 'hold-start' }]);
    expect(recording.phase).toBe('recording');
    expect(recording.correcting).toBe(false);

    const working = instructReducer(recording, { type: 'submit' });
    expect(working.phase).toBe('working');
    expect(workingLabel(working)).toBe('Working on it…');
    expect(workingLabel({ ...working, activity: 'Looking at your tasks…' })).toBe('Looking at your tasks…');
  });

  it('arms cancel when the finger lifts past the threshold, and disarms when it comes back', () => {
    const recording = run([{ type: 'hold-start' }]);
    const armed = instructReducer(recording, { type: 'hold-move', lift: CANCEL_LIFT + 1 });
    expect(armed.cancelArmed).toBe(true);
    expect(holdHint(armed)).toBe('Release to discard');

    const disarmed = instructReducer(armed, { type: 'hold-move', lift: 10 });
    expect(disarmed.cancelArmed).toBe(false);
    expect(holdHint(disarmed)).toBe('Release to send · Slide up to cancel');
  });

  it('cancelling a fresh hold returns to idle', () => {
    expect(run([{ type: 'hold-start' }, { type: 'hold-cancel' }])).toEqual(INITIAL_INSTRUCT_STATE);
  });

  it('lands the proposal with its session and transcript', () => {
    expect(proposed.phase).toBe('proposal');
    expect(proposed.proposal).toEqual(proposal);
    expect(proposed.claudeSessionId).toBe('claude-1');
    expect(proposed.transcript).toBe('move my run');
    expect(proposed.revised).toBe(false);
    expect(sheetHint(proposed)).toBe('Hold Coach to correct it');
  });

  it('holding over a proposal records a correction and keeps the sheet', () => {
    const correcting = instructReducer(proposed, { type: 'hold-start' });
    expect(correcting.phase).toBe('recording');
    expect(correcting.correcting).toBe(true);
    expect(correcting.proposal).toEqual(proposal);
    expect(holdHint(correcting)).toBe('Release to revise · Slide up to cancel');

    const backed = instructReducer(correcting, { type: 'hold-cancel' });
    expect(backed.phase).toBe('proposal');
    expect(backed.proposal).toEqual(proposal);
    expect(backed.correcting).toBe(false);
  });

  it('a correction replaces the proposal and marks it revised', () => {
    const revised = run(
      [
        { type: 'hold-start' },
        { type: 'submit' },
        { type: 'proposal', transcript: 'no, Friday', proposal: { summary: 'Reschedule one task', actions: ['Move run to Friday'] } },
      ],
      proposed
    );
    expect(revised.phase).toBe('proposal');
    expect(revised.revised).toBe(true);
    expect(revised.proposal?.actions).toEqual(['Move run to Friday']);
    expect(revised.claudeSessionId).toBe('claude-1');
    expect(workingLabel(run([{ type: 'hold-start' }, { type: 'submit' }], proposed))).toBe('Revising…');
  });

  it('hearing nothing during a correction keeps the proposal and says so inline', () => {
    const state = run([{ type: 'hold-start' }, { type: 'submit' }, { type: 'nothing-heard' }], proposed);
    expect(state.phase).toBe('proposal');
    expect(state.proposal).toEqual(proposal);
    expect(state.notice).toBe(NOTHING_HEARD);
  });

  it('hearing nothing on a fresh hold shows a notice that invites another try', () => {
    const state = run([{ type: 'hold-start' }, { type: 'submit' }, { type: 'nothing-heard' }]);
    expect(state.phase).toBe('notice');
    expect(state.notice).toBe(NOTHING_HEARD);
    expect(sheetHint(state)).toBe('Hold Coach to try again');
  });

  it('a question from the coach is a notice that a further hold answers', () => {
    const state = run(
      [{ type: 'hold-start' }, { type: 'submit' }, { type: 'session', claudeSessionId: 'claude-2' }, { type: 'notice', message: 'Which run?', transcript: 'move my run' }],
    );
    expect(state.phase).toBe('notice');
    expect(sheetHint(state)).toBe('Hold Coach to reply');
    expect(instructReducer(state, { type: 'hold-start' }).correcting).toBe(true);
  });

  it('applies, then toasts the number of changes and resets', () => {
    const applying = instructReducer(proposed, { type: 'apply' });
    expect(applying.phase).toBe('applying');
    expect(canHold(applying)).toBe(false);

    const applied = instructReducer(applying, { type: 'applied' });
    expect(applied.phase).toBe('toast');
    expect(applied.toast).toBe('Applied · 2 changes');
    expect(applied.proposal).toBeNull();
    expect(applied.claudeSessionId).toBeNull();
    expect(instructReducer(applied, { type: 'toast-expired' })).toEqual(INITIAL_INSTRUCT_STATE);
  });

  it('a failed apply becomes a notice on the same session', () => {
    const state = run([{ type: 'apply' }, { type: 'notice', message: 'The coach ran into a problem.' }], proposed);
    expect(state.phase).toBe('notice');
    expect(state.claudeSessionId).toBe('claude-1');
    expect(state.proposal).toBeNull();
  });

  it('ignores holds while working or applying, and dismiss only when a sheet is up', () => {
    const working = run([{ type: 'hold-start' }, { type: 'submit' }]);
    expect(instructReducer(working, { type: 'hold-start' })).toBe(working);
    expect(instructReducer(working, { type: 'dismiss' })).toBe(working);
    expect(instructReducer(proposed, { type: 'dismiss' })).toEqual(INITIAL_INSTRUCT_STATE);
  });
});

describe('parseProposal', () => {
  it('reads a summary and its bullets', () => {
    expect(parseProposal('Reschedule one task, add another\n- Move Evening run to tomorrow 07:00\n- Add task Buy oat milk to today')).toEqual({
      kind: 'proposal',
      proposal: {
        summary: 'Reschedule one task, add another',
        actions: ['Move Evening run to tomorrow 07:00', 'Add task Buy oat milk to today'],
      },
    });
  });

  it('accepts other bullet markers, stray emphasis and code fences', () => {
    expect(parseProposal('```\n**Two changes**\n• Move run\n* Add milk\n```')).toEqual({
      kind: 'proposal',
      proposal: { summary: 'Two changes', actions: ['Move run', 'Add milk'] },
    });
  });

  it('turns NOTHING into a notice with its reason', () => {
    expect(parseProposal('NOTHING: Evening run is already on Thursday.')).toEqual({
      kind: 'notice',
      message: 'Evening run is already on Thursday.',
    });
    expect(parseProposal('NOTHING')).toEqual({ kind: 'notice', message: NOTHING_TO_DO });
    expect(parseProposal('   ')).toEqual({ kind: 'notice', message: NOTHING_TO_DO });
  });

  it('treats a reply without bullets as a question to answer', () => {
    expect(parseProposal('Which run — the morning or the evening one?')).toEqual({
      kind: 'notice',
      message: 'Which run — the morning or the evening one?',
    });
  });
});

describe('holdOutcome', () => {
  it('submits a clean release that never rose past the cancel line', () => {
    expect(holdOutcome(true, 0)).toBe('submit');
    expect(holdOutcome(true, CANCEL_LIFT)).toBe('submit');
  });

  it('cancels a release above the cancel line, however fast the flick', () => {
    expect(holdOutcome(true, CANCEL_LIFT + 1)).toBe('cancel');
    expect(holdOutcome(true, 200)).toBe('cancel');
  });

  it('cancels a gesture that ended without a release', () => {
    expect(holdOutcome(false, 0)).toBe('cancel');
    expect(holdOutcome(false, 200)).toBe('cancel');
  });
});

describe('abort', () => {
  const working = run([{ type: 'hold-start' }, { type: 'submit' }]);

  it('returns a fresh propose to the plain screen', () => {
    const aborted = instructReducer(
      instructReducer(working, { type: 'session', claudeSessionId: 'claude-1' }),
      { type: 'abort' }
    );
    expect(aborted).toEqual(INITIAL_INSTRUCT_STATE);
  });

  it('returns a correction to the sheet it interrupted, intact', () => {
    const correcting = run([{ type: 'hold-start' }, { type: 'submit' }], proposed);
    const aborted = instructReducer(correcting, { type: 'abort' });
    expect(aborted.phase).toBe('proposal');
    expect(aborted.proposal).toEqual(proposal);
    expect(aborted.transcript).toBe('move my run');
    expect(aborted.claudeSessionId).toBe('claude-1');
    expect(aborted.correcting).toBe(false);
    expect(aborted.activity).toBeNull();
  });

  it('leaves every other phase alone, applying included', () => {
    const applying = run([{ type: 'apply' }], proposed);
    expect(instructReducer(applying, { type: 'abort' })).toBe(applying);
    expect(instructReducer(proposed, { type: 'abort' })).toBe(proposed);
    expect(instructReducer(INITIAL_INSTRUCT_STATE, { type: 'abort' })).toBe(INITIAL_INSTRUCT_STATE);
  });
});

describe('formatting', () => {
  it('counts changes', () => {
    expect(formatApplied(0)).toBe('Applied');
    expect(formatApplied(1)).toBe('Applied · 1 change');
    expect(formatApplied(3)).toBe('Applied · 3 changes');
  });

  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_400)).toBe('0:07');
    expect(formatElapsed(65_000)).toBe('1:05');
  });
});
