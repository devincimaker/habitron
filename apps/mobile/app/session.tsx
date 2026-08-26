import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CoachSessionScreen } from '../components/CoachSessionScreen';
import { useSessionStore } from '../stores/useSessionStore';
import { getSession } from '../services/sessions';
import { getTodayDate, type RitualId } from '@habits-coach/shared';

export default function ModalSessionRoute() {
  const router = useRouter();
  const { sessionId, ritual, date } = useLocalSearchParams<{
    sessionId?: string;
    ritual?: RitualId;
    date?: string;
  }>();
  const startSession = useSessionStore((state) => state.startSession);
  const hydrateSession = useSessionStore((state) => state.hydrateSession);
  const leaveSession = useSessionStore((state) => state.leaveSession);

  // The route owns the session's lifetime: opening it starts or resumes a
  // session, and unmounting leaves it open. Only End (in the screen) finalizes.
  useEffect(() => {
    let cancelled = false;

    if (sessionId) {
      getSession(sessionId)
        .then((session) => {
          if (!cancelled) hydrateSession(session);
        })
        .catch((error) => {
          console.warn('Failed to open session:', error);
          if (cancelled) return;
          Alert.alert('Could not open session', 'Please try again.');
          router.back();
        });
    } else if (ritual) {
      // Find-or-create lives in the backend, so tapping the card again that day
      // resumes the same session rather than opening a second one.
      void startSession({ opener: ritual, ritualDate: date ?? getTodayDate() });
    } else {
      void startSession();
    }

    return () => {
      cancelled = true;
      void leaveSession();
    };
  }, [sessionId, ritual, date, startSession, hydrateSession, leaveSession, router]);

  return <CoachSessionScreen onDismiss={() => router.back()} />;
}
