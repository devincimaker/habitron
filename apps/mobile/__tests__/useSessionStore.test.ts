/**
 * Session Store Tests
 *
 * The coach speaks first, so a backend session is created as soon as a
 * session starts; sessions the user never replied in are deleted on end or
 * on leave. A session opened from the hub is hydrated in place, left open
 * when you leave, named by the first user message, and reopened if you keep
 * talking in a finalized one.
 */

const mockCreateSession = jest.fn();

/** What POST /api/sessions returns for a session with nothing in it yet. */
const createdSession = (id: string) => ({
  id,
  name: null,
  startedAt: Date.now(),
  endedAt: null,
  opener: 'coach' as const,
  ritualDate: null,
  messages: [],
  memories: [],
});
const mockUpdateSession = jest.fn();
const mockFinalizeSession = jest.fn();
const mockDeleteSession = jest.fn();

jest.mock('../services/sessions', () => ({
  createSession: () => mockCreateSession(),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  finalizeSession: (...args: unknown[]) => mockFinalizeSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
}));

import type { CoachingSessionDetail } from '@habits-coach/shared';
import { useSessionStore } from '../stores/useSessionStore';

function buildDetail(overrides: Partial<CoachingSessionDetail> = {}): CoachingSessionDetail {
  return {
    id: 'past-session',
    name: 'Morning routine',
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_600_000,
    memoryCount: 1,
    opener: 'coach',
    ritualDate: null,
    messages: [
      { role: 'assistant', content: 'Hi', timestamp: 1_700_000_000_000 },
      { role: 'user', content: 'Help me with mornings', timestamp: 1_700_000_100_000 },
      { role: 'assistant', content: 'Sure', timestamp: 1_700_000_200_000 },
    ],
    memories: [],
    lastTurn: null,
    ...overrides,
  };
}

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      isActive: false,
      sessionId: null,
      name: null,
      startedAt: null,
      endedAt: null,
      lastActiveAt: null,
      messages: [],
      isLoading: false,
      isSyncing: false,
      startError: null,
    });
    jest.clearAllMocks();
    mockUpdateSession.mockResolvedValue(undefined);
    mockDeleteSession.mockResolvedValue(undefined);
  });

  it('creates the backend session on start with an empty transcript', async () => {
    mockCreateSession.mockResolvedValue(createdSession('test-session-id'));

    await useSessionStore.getState().startSession();

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().isActive).toBe(true);
    expect(useSessionStore.getState().sessionId).toBe('test-session-id');
    expect(useSessionStore.getState().messages).toEqual([]);
    expect(useSessionStore.getState().startError).toBeNull();
  });

  it('records a start error when the backend is unreachable and retries on demand', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('Network error'));

    await useSessionStore.getState().startSession();

    expect(useSessionStore.getState().isActive).toBe(true);
    expect(useSessionStore.getState().sessionId).toBeNull();
    expect(useSessionStore.getState().startError).toBe('Network error');

    mockCreateSession.mockResolvedValueOnce(createdSession('retry-id'));
    await expect(useSessionStore.getState().ensureBackendSession()).resolves.toBe('retry-id');
    expect(useSessionStore.getState().startError).toBeNull();
  });

  it('does not create a second backend session once one exists', async () => {
    mockCreateSession.mockResolvedValue(createdSession('test-session-id'));

    await useSessionStore.getState().startSession();
    await useSessionStore.getState().ensureBackendSession();
    await useSessionStore.getState().addMessage({ role: 'assistant', content: 'Hello' });

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
  });

  it('names the session after the first user message, once', async () => {
    mockCreateSession.mockResolvedValue(createdSession('test-session-id'));
    await useSessionStore.getState().startSession();

    await useSessionStore.getState().addMessage({
      role: 'user',
      content: '  I keep skipping my evening walk  ',
    });

    expect(mockUpdateSession.mock.calls[0]).toEqual([
      'test-session-id',
      { name: 'I keep skipping my evening walk' },
    ]);
    expect(mockUpdateSession.mock.calls[1][1]).toEqual({ messages: expect.any(Array) });
    expect(useSessionStore.getState().name).toBe('I keep skipping my evening walk');

    await useSessionStore.getState().addMessage({ role: 'user', content: 'Second thought' });
    expect(mockUpdateSession).toHaveBeenCalledTimes(3);
    expect(mockUpdateSession.mock.calls[2][1]).toEqual({ messages: expect.any(Array) });
  });

  it('streams into a message locally and syncs when finalized', async () => {
    mockCreateSession.mockResolvedValue(createdSession('test-session-id'));
    await useSessionStore.getState().startSession();

    const id = useSessionStore.getState().addLocalMessage({ role: 'assistant', content: 'Hel' });
    useSessionStore.getState().appendToMessage(id, 'lo');
    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().messages[0].content).toBe('Hello');

    await useSessionStore.getState().finalizeMessage(id, 'Hello there');

    expect(useSessionStore.getState().messages[0].content).toBe('Hello there');
    expect(mockUpdateSession).toHaveBeenCalledWith('test-session-id', {
      messages: [expect.objectContaining({ role: 'assistant', content: 'Hello there' })],
    });
  });

  it('deletes the session on end when the user never replied', async () => {
    mockCreateSession.mockResolvedValue(createdSession('test-session-id'));
    await useSessionStore.getState().startSession();
    useSessionStore.getState().addLocalMessage({ role: 'assistant', content: 'How is today going?' });

    await useSessionStore.getState().endSession();

    expect(mockDeleteSession).toHaveBeenCalledWith('test-session-id');
    expect(mockFinalizeSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().isActive).toBe(false);
    expect(useSessionStore.getState().sessionId).toBeNull();
    expect(useSessionStore.getState().messages).toEqual([]);
  });

  it('syncs and finalizes on end when the user took part', async () => {
    mockCreateSession.mockResolvedValue(createdSession('test-session-id'));
    mockFinalizeSession.mockResolvedValue({ name: 'Test Session' });
    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({ role: 'user', content: 'User message' });

    await useSessionStore.getState().endSession();

    expect(mockDeleteSession).not.toHaveBeenCalled();
    expect(mockFinalizeSession).toHaveBeenCalledWith('test-session-id', { extractMemories: false });
    expect(useSessionStore.getState().startedAt).toBeNull();
    expect(useSessionStore.getState().lastActiveAt).toBeNull();
  });

  describe('leaving', () => {
    it('persists the transcript and clears state without finalizing', async () => {
      mockCreateSession.mockResolvedValue(createdSession('test-session-id'));
      await useSessionStore.getState().startSession();
      await useSessionStore.getState().addMessage({ role: 'user', content: 'Hello' });
      mockUpdateSession.mockClear();

      await useSessionStore.getState().leaveSession();

      expect(mockUpdateSession).toHaveBeenCalledTimes(1);
      expect(mockUpdateSession).toHaveBeenCalledWith('test-session-id', {
        messages: [expect.objectContaining({ role: 'user', content: 'Hello' })],
      });
      expect(mockFinalizeSession).not.toHaveBeenCalled();
      expect(mockDeleteSession).not.toHaveBeenCalled();
      expect(useSessionStore.getState().isActive).toBe(false);
      expect(useSessionStore.getState().sessionId).toBeNull();
      expect(useSessionStore.getState().messages).toEqual([]);
    });

    it('deletes the session when the user never replied', async () => {
      mockCreateSession.mockResolvedValue(createdSession('test-session-id'));
      await useSessionStore.getState().startSession();
      useSessionStore.getState().addLocalMessage({ role: 'assistant', content: 'How is today going?' });

      await useSessionStore.getState().leaveSession();

      expect(mockDeleteSession).toHaveBeenCalledWith('test-session-id');
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });
  });

  describe('rituals', () => {
    it('starts the day\'s ritual empty, so the opener runs', async () => {
      mockCreateSession.mockResolvedValue({
        ...createdSession('ritual-id'),
        opener: 'review-day',
        ritualDate: '2026-08-26',
      });

      await useSessionStore
        .getState()
        .startSession({ opener: 'review-day', ritualDate: '2026-08-26' });

      const state = useSessionStore.getState();
      expect(state.opener).toBe('review-day');
      expect(state.ritualDate).toBe('2026-08-26');
      expect(state.messages).toEqual([]);
    });

    // Tapping the card again that day gets the same session back. Starting it
    // empty would re-send the opener and overwrite the transcript on first sync.
    it('resumes the transcript when the day already has that ritual', async () => {
      mockCreateSession.mockResolvedValue(
        buildDetail({ id: 'ritual-id', opener: 'review-day', ritualDate: '2026-08-26' })
      );

      await useSessionStore
        .getState()
        .startSession({ opener: 'review-day', ritualDate: '2026-08-26' });

      const state = useSessionStore.getState();
      expect(state.sessionId).toBe('ritual-id');
      expect(state.opener).toBe('review-day');
      expect(state.ritualDate).toBe('2026-08-26');
      expect(state.messages).toHaveLength(3);
    });
  });

  describe('sessions opened from the hub', () => {
    it('hydrates transcript and identity from a session detail', () => {
      useSessionStore.getState().hydrateSession(buildDetail({ endedAt: null }));

      const state = useSessionStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.sessionId).toBe('past-session');
      expect(state.name).toBe('Morning routine');
      expect(state.startedAt).toBe(1_700_000_000_000);
      expect(state.endedAt).toBeNull();
      expect(state.startError).toBeNull();
      expect(state.messages.map((m) => [m.role, m.content])).toEqual([
        ['assistant', 'Hi'],
        ['user', 'Help me with mornings'],
        ['assistant', 'Sure'],
      ]);
      expect(new Set(state.messages.map((m) => m.id)).size).toBe(3);
    });

    it('continues an open session in place without renaming it', async () => {
      useSessionStore.getState().hydrateSession(buildDetail({ endedAt: null }));

      await useSessionStore.getState().addMessage({ role: 'user', content: 'More' });

      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockUpdateSession).toHaveBeenCalledTimes(1);
      expect(mockUpdateSession).toHaveBeenCalledWith('past-session', {
        messages: expect.any(Array),
      });
      expect(useSessionStore.getState().messages).toHaveLength(4);
    });

    it('reopens a finalized session on the first new user message', async () => {
      useSessionStore.getState().hydrateSession(buildDetail());
      expect(useSessionStore.getState().endedAt).not.toBeNull();

      await useSessionStore.getState().addMessage({ role: 'user', content: 'One more thing' });

      expect(mockUpdateSession.mock.calls[0]).toEqual([
        'past-session',
        { endedAt: null, isProcessed: false },
      ]);
      expect(mockUpdateSession.mock.calls[1][1]).toEqual({ messages: expect.any(Array) });
      expect(useSessionStore.getState().endedAt).toBeNull();

      await useSessionStore.getState().addMessage({ role: 'user', content: 'And another' });
      expect(mockUpdateSession).toHaveBeenCalledTimes(3);
    });

    it('rejects the message when reopening fails', async () => {
      mockUpdateSession.mockRejectedValueOnce(new Error('Network error'));
      useSessionStore.getState().hydrateSession(buildDetail());

      await expect(
        useSessionStore.getState().addMessage({ role: 'user', content: 'One more thing' })
      ).rejects.toThrow('Network error');

      expect(useSessionStore.getState().endedAt).not.toBeNull();
      expect(useSessionStore.getState().messages).toHaveLength(3);
    });
  });
});
