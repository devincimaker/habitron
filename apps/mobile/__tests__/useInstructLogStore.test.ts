import type { InstructActionRow } from '@habits-coach/shared';

jest.mock('../services/api', () => {
  class NothingHeardError extends Error {}
  class TranscriptionTimeoutError extends Error {}
  return {
    NothingHeardError,
    TranscriptionTimeoutError,
    enqueueInstruction: jest.fn(),
    fetchInstructLog: jest.fn(),
    postInstructAction: jest.fn(),
  };
});

const noopStore = (method: string) => ({ getState: () => ({ [method]: jest.fn().mockResolvedValue(undefined) }) });
jest.mock('../stores/useDailyPlansStore', () => ({ useDailyPlansStore: noopStore('loadPlan') }));
jest.mock('../stores/useGoalsStore', () => ({ useGoalsStore: noopStore('loadGoals') }));
jest.mock('../stores/useHabitsStore', () => ({ useHabitsStore: noopStore('loadHabits') }));
jest.mock('../stores/useJournalStore', () => ({ useJournalStore: noopStore('loadEntries') }));
jest.mock('../stores/useTodosStore', () => ({ useTodosStore: noopStore('loadTodos') }));

import { NothingHeardError, enqueueInstruction, fetchInstructLog } from '../services/api';
import { useInstructLogStore } from '../stores/useInstructLogStore';
import { NOTHING_HEARD, UPLOAD_FAILED } from '../utils/instruct';

const mockedEnqueue = enqueueInstruction as jest.Mock;
const mockedLog = fetchInstructLog as jest.Mock;

/** The row the server made from the upload whose reply never came back. */
function landedRow(id: string): InstructActionRow {
  return {
    id,
    status: 'applied',
    transcript: 'buy the game Juan sent me',
    summary: null,
    result: 'Added it to the Inbox',
    error: null,
    createdAt: '2026-09-02T14:56:01Z',
    startedAt: '2026-09-02T14:56:01Z',
    finishedAt: '2026-09-02T14:56:14Z',
  };
}

/** The id the store minted for the upload it just tried. */
function submittedId(): string {
  return mockedEnqueue.mock.calls[0][0].id as string;
}

describe('useInstructLogStore.submit when the reply is lost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useInstructLogStore.getState().clear();
  });

  it('says nothing went wrong when the log has the row the upload made', async () => {
    // iOS suspended the pocketed phone mid-upload: the body arrived, the reply did not.
    mockedEnqueue.mockRejectedValue(new TypeError('Network request failed'));
    mockedLog.mockImplementation(async () => [landedRow(submittedId())]);

    await useInstructLogStore.getState().submit('file://recording.m4a');

    const state = useInstructLogStore.getState();
    expect(state.notice).toBeNull();
    expect(state.actions.map((action) => action.id)).toEqual([submittedId()]);
    expect(state.unconfirmed).toEqual([]);
  });

  it('still reports a failure when the log says the row was never made', async () => {
    mockedEnqueue.mockRejectedValue(new TypeError('Network request failed'));
    mockedLog.mockResolvedValue([]);

    await useInstructLogStore.getState().submit('file://recording.m4a');

    const state = useInstructLogStore.getState();
    expect(state.notice).toBe(UPLOAD_FAILED);
    // The log answered, so the verdict is in: nothing left to reconcile.
    expect(state.unconfirmed).toEqual([]);
  });

  it('holds the question open when the log cannot be reached either', async () => {
    mockedEnqueue.mockRejectedValue(new TypeError('Network request failed'));
    mockedLog.mockRejectedValue(new TypeError('Network request failed'));

    await useInstructLogStore.getState().submit('file://recording.m4a');

    expect(useInstructLogStore.getState().notice).toBe(UPLOAD_FAILED);
    expect(useInstructLogStore.getState().unconfirmed).toEqual([submittedId()]);

    // Back in the foreground, the row turns up and the notice was wrong.
    mockedLog.mockResolvedValue([landedRow(submittedId())]);
    await useInstructLogStore.getState().refresh();

    const state = useInstructLogStore.getState();
    expect(state.notice).toBeNull();
    expect(state.unconfirmed).toEqual([]);
  });

  it('leaves "didn’t catch that" alone — the server heard the upload and heard silence', async () => {
    mockedEnqueue.mockRejectedValue(new NothingHeardError());

    await useInstructLogStore.getState().submit('file://recording.m4a');

    expect(useInstructLogStore.getState().notice).toBe(NOTHING_HEARD);
    expect(mockedLog).not.toHaveBeenCalled();
  });
});
