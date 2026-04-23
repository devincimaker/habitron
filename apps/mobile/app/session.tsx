import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CoachSessionScreen } from '../components/CoachSessionScreen';
import { useSessionStore } from '../stores/useSessionStore';
import { useSessionsStore } from '../stores/useSessionsStore';
import { ensureCoachSession } from '../utils/ensureCoachSession';

export default function ModalSessionRoute() {
  const router = useRouter();
  const { autoPrompt } = useLocalSearchParams<{
    autoPrompt?: string;
  }>();
  const startSession = useSessionStore((state) => state.startSession);
  const checkAndRecoverSession = useSessionStore((state) => state.checkAndRecoverSession);
  const loadSessions = useSessionsStore((state) => state.loadSessions);

  useEffect(() => {
    void ensureCoachSession({
      getSessionState: () => {
        const state = useSessionStore.getState();
        return {
          isActive: state.isActive,
          messages: state.messages,
        };
      },
      checkAndRecoverSession,
      loadSessions,
      startSession,
    });
  }, [checkAndRecoverSession, loadSessions, startSession]);

  return (
    <CoachSessionScreen
      autoPrompt={autoPrompt}
      onDismiss={() => router.back()}
    />
  );
}
