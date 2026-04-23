type SessionRecoveryResult = 'recovered' | 'finalized' | 'none';

interface CoachSessionSnapshot {
  isActive: boolean;
  messages: { id: string }[];
}

interface EnsureCoachSessionDependencies {
  getSessionState: () => CoachSessionSnapshot;
  checkAndRecoverSession: () => Promise<SessionRecoveryResult>;
  loadSessions: () => Promise<void>;
  startSession: () => Promise<void>;
}

export async function ensureCoachSession({
  getSessionState,
  checkAndRecoverSession,
  loadSessions,
  startSession,
}: EnsureCoachSessionDependencies): Promise<void> {
  const current = getSessionState();
  if (current.isActive && current.messages.length > 0) {
    return;
  }

  const result = await checkAndRecoverSession();

  if (result === 'finalized') {
    await loadSessions();
  }

  const next = getSessionState();
  if (!next.isActive || next.messages.length === 0) {
    await startSession();
  }
}
