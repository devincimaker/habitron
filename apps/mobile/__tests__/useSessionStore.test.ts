/**
 * Session Store Tests
 *
 * The coach speaks first, so a backend session is created as soon as a
 * session starts; sessions the user never replied in are deleted on end.
 */

const mockCreateSession = jest.fn();
const mockUpdateSession = jest.fn();
const mockFinalizeSession = jest.fn();
const mockDeleteSession = jest.fn();
const mockGetActiveSession = jest.fn();

jest.mock('../services/sessions', () => ({
  createSession: () => mockCreateSession(),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  finalizeSession: (...args: unknown[]) => mockFinalizeSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  getActiveSession: () => mockGetActiveSession(),
}));

import { useSessionStore } from '../stores/useSessionStore';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      isActive: false,
      sessionId: null,
      startedAt: null,
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
    mockCreateSession.mockResolvedValue({ id: 'test-session-id', startedAt: Date.now() });

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

    mockCreateSession.mockResolvedValueOnce({ id: 'retry-id', startedAt: Date.now() });
    await expect(useSessionStore.getState().ensureBackendSession()).resolves.toBe('retry-id');
    expect(useSessionStore.getState().startError).toBeNull();
  });

  it('does not create a second backend session once one exists', async () => {
    mockCreateSession.mockResolvedValue({ id: 'test-session-id', startedAt: Date.now() });

    await useSessionStore.getState().startSession();
    await useSessionStore.getState().ensureBackendSession();
    await useSessionStore.getState().addMessage({ role: 'user', content: 'Hello' });

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
  });

  it('streams into a message locally and syncs when finalized', async () => {
    mockCreateSession.mockResolvedValue({ id: 'test-session-id', startedAt: Date.now() });
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
    mockCreateSession.mockResolvedValue({ id: 'test-session-id', startedAt: Date.now() });
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
    mockCreateSession.mockResolvedValue({ id: 'test-session-id', startedAt: Date.now() });
    mockFinalizeSession.mockResolvedValue({ name: 'Test Session' });
    await useSessionStore.getState().startSession();
    await useSessionStore.getState().addMessage({ role: 'user', content: 'User message' });

    await useSessionStore.getState().endSession();

    expect(mockDeleteSession).not.toHaveBeenCalled();
    expect(mockFinalizeSession).toHaveBeenCalledWith('test-session-id', { extractMemories: false });
    expect(useSessionStore.getState().startedAt).toBeNull();
    expect(useSessionStore.getState().lastActiveAt).toBeNull();
  });

  it('recovers a recent active session with its transcript', async () => {
    const updatedAt = Date.now() - 60_000;
    mockGetActiveSession.mockResolvedValue({
      id: 'active-id',
      startedAt: updatedAt - 1000,
      updatedAt,
      messages: [
        { role: 'assistant', content: 'Hi', timestamp: updatedAt - 500 },
        { role: 'user', content: 'Hello', timestamp: updatedAt },
      ],
    });

    await expect(useSessionStore.getState().checkAndRecoverSession()).resolves.toBe('recovered');

    expect(useSessionStore.getState().sessionId).toBe('active-id');
    expect(useSessionStore.getState().messages.map((m) => m.content)).toEqual(['Hi', 'Hello']);
  });

  it('deletes a stale active session that only holds the opener', async () => {
    const updatedAt = Date.now() - 11 * 60 * 1000;
    mockGetActiveSession.mockResolvedValue({
      id: 'stale-id',
      startedAt: updatedAt,
      updatedAt,
      messages: [{ role: 'assistant', content: 'Hi', timestamp: updatedAt }],
    });

    await expect(useSessionStore.getState().checkAndRecoverSession()).resolves.toBe('finalized');

    expect(mockDeleteSession).toHaveBeenCalledWith('stale-id');
    expect(mockFinalizeSession).not.toHaveBeenCalled();
  });
});
