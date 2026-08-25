/**
 * Session Store Tests
 *
 * Sessions are only persisted to the backend when the user sends their first
 * message, so empty sessions never clutter the hub. A session opened from the
 * hub is hydrated in place, left open when you leave, and reopened if you
 * keep talking in a finalized one.
 */

// Mock sessions service before importing the store
const mockCreateSession = jest.fn();
const mockUpdateSession = jest.fn();
const mockFinalizeSession = jest.fn();

jest.mock('../services/sessions', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  finalizeSession: (...args: unknown[]) => mockFinalizeSession(...args),
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
    leadSkillId: 'habit-design',
    messages: [
      { role: 'assistant', content: 'Hi', timestamp: 1_700_000_000_000 },
      { role: 'user', content: 'Help me with mornings', timestamp: 1_700_000_100_000 },
      { role: 'assistant', content: 'Sure', timestamp: 1_700_000_200_000 },
    ],
    memories: [],
    ...overrides,
  };
}

describe('useSessionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSessionStore.setState({
      isActive: false,
      sessionId: null,
      startedAt: null,
      endedAt: null,
      lastActiveAt: null,
      messages: [],
      isLoading: false,
      isSyncing: false,
      isCreatingSession: false,
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  /**
   * Test: Starting a session should NOT create a backend record
   *
   * When a user taps the "New Session" button, we should only initialize
   * local state. No API call should be made until they actually send a message.
   * This prevents empty sessions from being created when users accidentally
   * tap the button or decide not to chat.
   */
  it('should not call createSession on startSession', async () => {
    await useSessionStore.getState().startSession();

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().isActive).toBe(true);
    expect(useSessionStore.getState().sessionId).toBeNull();
    expect(useSessionStore.getState().messages).toHaveLength(1);
    expect(useSessionStore.getState().messages[0].role).toBe('assistant');
  });

  /**
   * Test: First user message should trigger backend session creation
   *
   * When the user sends their first message, we create the session in the
   * backend and sync all messages (including the welcome message).
   */
  it('should create backend session on first user message', async () => {
    mockCreateSession.mockResolvedValue({
      id: 'test-session-id',
      startedAt: Date.now(),
    });
    mockUpdateSession.mockResolvedValue(undefined);

    await useSessionStore.getState().startSession();
    expect(mockCreateSession).not.toHaveBeenCalled();

    await useSessionStore.getState().addMessage({ role: 'user', content: 'Hello' });

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().sessionId).toBe('test-session-id');
    expect(mockUpdateSession).toHaveBeenCalled();
  });

  /**
   * Test: The backend session is born with a provisional name
   *
   * Open sessions would otherwise read "Untitled Session" in the hub until
   * finalize generates a summary.
   */
  it('names the backend session after the first user message', async () => {
    mockCreateSession.mockResolvedValue({ id: 'test-session-id', startedAt: Date.now() });
    mockUpdateSession.mockResolvedValue(undefined);

    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({
      role: 'user',
      content: '  I keep skipping my evening walk  ',
    });

    expect(mockCreateSession).toHaveBeenCalledWith({ name: 'I keep skipping my evening walk' });
  });

  /**
   * Test: Subsequent messages should NOT create new sessions
   *
   * Once a session is created, additional messages should just sync
   * without trying to create another session.
   */
  it('should not create duplicate sessions on subsequent messages', async () => {
    mockCreateSession.mockResolvedValue({
      id: 'test-session-id',
      startedAt: Date.now(),
    });
    mockUpdateSession.mockResolvedValue(undefined);

    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({ role: 'user', content: 'First message' });
    await useSessionStore.getState().addMessage({ role: 'user', content: 'Second message' });

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: Assistant messages should NOT trigger session creation
   *
   * Only user messages should trigger backend session creation.
   * Assistant (AI) responses are added locally but don't create sessions.
   */
  it('should not create session for assistant messages', async () => {
    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({ role: 'assistant', content: 'AI response' });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().sessionId).toBeNull();
    expect(useSessionStore.getState().messages).toHaveLength(2);
  });

  /**
   * Test: Ending session without user messages should skip finalization
   *
   * If user starts a session but closes without sending any message,
   * we should just clear local state without calling the finalize API.
   */
  it('should skip finalization when ending session with no user messages', async () => {
    await useSessionStore.getState().startSession();
    await useSessionStore.getState().endSession();

    expect(mockFinalizeSession).not.toHaveBeenCalled();
    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().isActive).toBe(false);
    expect(useSessionStore.getState().messages).toEqual([]);
  });

  /**
   * Test: Ending session WITH user messages should finalize normally
   *
   * Normal flow: user sends messages, ends session, finalization happens.
   */
  it('should finalize session when ending with user messages', async () => {
    mockCreateSession.mockResolvedValue({
      id: 'test-session-id',
      startedAt: Date.now(),
    });
    mockUpdateSession.mockResolvedValue(undefined);
    mockFinalizeSession.mockResolvedValue({
      name: 'Test Session',
    });

    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({ role: 'user', content: 'User message' });
    await useSessionStore.getState().endSession();

    expect(mockFinalizeSession).toHaveBeenCalledWith('test-session-id', {
      extractMemories: false,
    });
  });

  /**
   * Test: Session state is properly cleared after ending
   *
   * Verify all state is reset after endSession, regardless of whether
   * the session was persisted or not.
   */
  it('should clear all state when ending session', async () => {
    await useSessionStore.getState().startSession();

    expect(useSessionStore.getState().isActive).toBe(true);
    expect(useSessionStore.getState().messages.length).toBeGreaterThan(0);

    await useSessionStore.getState().endSession();

    expect(useSessionStore.getState().isActive).toBe(false);
    expect(useSessionStore.getState().sessionId).toBeNull();
    expect(useSessionStore.getState().startedAt).toBeNull();
    expect(useSessionStore.getState().lastActiveAt).toBeNull();
    expect(useSessionStore.getState().messages).toEqual([]);
  });

  /**
   * Test: Backend creation failure should reject the user message
   *
   * Session creation is required for orchestrated coach state. If backend
   * session creation fails, we should not append a user message locally.
   */
  it('should reject first user message when backend session creation fails', async () => {
    mockCreateSession.mockRejectedValue(new Error('Network error'));

    await useSessionStore.getState().startSession();
    await expect(
      useSessionStore.getState().addMessage({ role: 'user', content: 'Hello' })
    ).rejects.toThrow('Network error');

    expect(useSessionStore.getState().isActive).toBe(true);
    expect(useSessionStore.getState().messages).toHaveLength(1);
    expect(useSessionStore.getState().messages[0].role).toBe('assistant');
    expect(useSessionStore.getState().sessionId).toBeNull();
  });

  it('should update proposal state on an existing message', async () => {
    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({
      role: 'assistant',
      content: 'Here is a plan.',
      proposal: {
        actions: [],
        dailyPlanDraft: {
          date: '2026-04-13',
          items: [
            {
              itemType: 'note',
              title: 'Deep work',
              scheduledTime: '13:00',
            },
          ],
        },
      },
      proposalStatus: 'pending',
    });

    const proposalMessage = useSessionStore
      .getState()
      .messages
      .find((message) => message.proposal);

    expect(proposalMessage).toBeTruthy();

    useSessionStore.getState().updateMessage(proposalMessage!.id, {
      proposalStatus: 'applied',
    });

    expect(
      useSessionStore
        .getState()
        .messages
        .find((message) => message.id === proposalMessage!.id)?.proposalStatus
    ).toBe('applied');
  });

  describe('sessions opened from the hub', () => {
    it('hydrates messages and identity from a session detail', () => {
      useSessionStore.getState().hydrateSession(buildDetail({ endedAt: null }));

      const state = useSessionStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.sessionId).toBe('past-session');
      expect(state.startedAt).toBe(1_700_000_000_000);
      expect(state.endedAt).toBeNull();
      expect(state.messages.map((m) => [m.role, m.content])).toEqual([
        ['assistant', 'Hi'],
        ['user', 'Help me with mornings'],
        ['assistant', 'Sure'],
      ]);
      expect(new Set(state.messages.map((m) => m.id)).size).toBe(3);
    });

    it('seeds the welcome message when the stored transcript is empty', () => {
      useSessionStore.getState().hydrateSession(buildDetail({ messages: [] }));

      expect(useSessionStore.getState().messages).toHaveLength(1);
      expect(useSessionStore.getState().messages[0].role).toBe('assistant');
    });

    it('leaving syncs messages and clears state without finalizing', async () => {
      mockUpdateSession.mockResolvedValue(undefined);
      useSessionStore.getState().hydrateSession(buildDetail({ endedAt: null }));

      await useSessionStore.getState().leaveSession();

      expect(mockUpdateSession).toHaveBeenCalledTimes(1);
      expect(mockUpdateSession).toHaveBeenCalledWith('past-session', {
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Help me with mornings' }),
        ]),
      });
      expect(mockFinalizeSession).not.toHaveBeenCalled();
      expect(useSessionStore.getState().isActive).toBe(false);
      expect(useSessionStore.getState().sessionId).toBeNull();
      expect(useSessionStore.getState().messages).toEqual([]);
    });

    it('continues an open session in place on the next message', async () => {
      mockUpdateSession.mockResolvedValue(undefined);
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
      mockUpdateSession.mockResolvedValue(undefined);
      useSessionStore.getState().hydrateSession(buildDetail());
      expect(useSessionStore.getState().endedAt).not.toBeNull();

      await useSessionStore.getState().addMessage({ role: 'user', content: 'One more thing' });

      expect(mockCreateSession).not.toHaveBeenCalled();
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

  it('returns the created message id from addMessage', async () => {
    await useSessionStore.getState().startSession();

    const messageId = await useSessionStore.getState().addMessage({
      role: 'assistant',
      content: 'Here is a plan.',
    });

    expect(
      useSessionStore
        .getState()
        .messages
        .find((message) => message.id === messageId)
    ).toEqual(
      expect.objectContaining({
        id: messageId,
        role: 'assistant',
        content: 'Here is a plan.',
      })
    );
  });
});
