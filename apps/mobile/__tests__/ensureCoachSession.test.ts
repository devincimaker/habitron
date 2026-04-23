import { ensureCoachSession } from '../utils/ensureCoachSession';

describe('ensureCoachSession', () => {
  it('does nothing when an active session already has messages', async () => {
    const checkAndRecoverSession = jest.fn();
    const loadSessions = jest.fn();
    const startSession = jest.fn();

    await ensureCoachSession({
      getSessionState: () => ({
        isActive: true,
        messages: [{ id: 'welcome' }],
      }),
      checkAndRecoverSession,
      loadSessions,
      startSession,
    });

    expect(checkAndRecoverSession).not.toHaveBeenCalled();
    expect(loadSessions).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });

  it('starts a new session when recovery finds nothing', async () => {
    const checkAndRecoverSession = jest.fn().mockResolvedValue('none');
    const loadSessions = jest.fn();
    const startSession = jest.fn();

    await ensureCoachSession({
      getSessionState: () => ({
        isActive: false,
        messages: [],
      }),
      checkAndRecoverSession,
      loadSessions,
      startSession,
    });

    expect(checkAndRecoverSession).toHaveBeenCalledTimes(1);
    expect(loadSessions).not.toHaveBeenCalled();
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('refreshes sessions after finalizing an orphaned session, then starts a new one', async () => {
    const checkAndRecoverSession = jest.fn().mockResolvedValue('finalized');
    const loadSessions = jest.fn().mockResolvedValue(undefined);
    const startSession = jest.fn();

    await ensureCoachSession({
      getSessionState: () => ({
        isActive: false,
        messages: [],
      }),
      checkAndRecoverSession,
      loadSessions,
      startSession,
    });

    expect(loadSessions).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('does not start a new session if recovery restored one', async () => {
    const checkAndRecoverSession = jest.fn().mockImplementation(async () => {
      recoveredState.isActive = true;
      recoveredState.messages = [{ id: 'recovered-message' }];
      return 'recovered';
    });
    const loadSessions = jest.fn();
    const startSession = jest.fn();
    const recoveredState = {
      isActive: false,
      messages: [] as { id: string }[],
    };

    await ensureCoachSession({
      getSessionState: () => recoveredState,
      checkAndRecoverSession,
      loadSessions,
      startSession,
    });

    expect(loadSessions).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });
});
