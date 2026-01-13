/**
 * Session Store Tests - Lazy Session Creation
 *
 * These tests verify that sessions are only persisted to the backend
 * when the user sends their first message, preventing empty sessions
 * from cluttering the session history.
 */

// Mock sessions service before importing the store
const mockCreateSession = jest.fn();
const mockUpdateSession = jest.fn();
const mockFinalizeSession = jest.fn();
const mockGetActiveSession = jest.fn();

jest.mock('../services/sessions', () => ({
  createSession: () => mockCreateSession(),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  finalizeSession: (...args: unknown[]) => mockFinalizeSession(...args),
  getActiveSession: () => mockGetActiveSession(),
}));

import { useSessionStore } from '../stores/useSessionStore';

describe('useSessionStore - Lazy Session Creation', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSessionStore.setState({
      isActive: false,
      sessionId: null,
      startedAt: null,
      lastActiveAt: null,
      messages: [],
      isLoading: false,
      isSyncing: false,
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

    expect(mockFinalizeSession).toHaveBeenCalledWith('test-session-id');
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
   * Test: Backend creation failure should not crash the app
   *
   * If the backend call fails, the message should still be added locally
   * and the app should continue to function.
   */
  it('should handle backend creation failure gracefully', async () => {
    mockCreateSession.mockRejectedValue(new Error('Network error'));

    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({ role: 'user', content: 'Hello' });

    expect(useSessionStore.getState().isActive).toBe(true);
    expect(useSessionStore.getState().messages).toHaveLength(2);
    expect(useSessionStore.getState().sessionId).toBeNull();
  });
});
