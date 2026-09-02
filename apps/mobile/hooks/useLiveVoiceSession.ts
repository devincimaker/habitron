import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as Sentry from '@sentry/react-native';
import { getTodayDate } from '@habits-coach/shared';
import VoiceSession from '../modules/voice-session';
import { streamCoachTurn, transcribeAudio } from '../services/api';
import { getCoachRequestErrorMessage } from '../services/apiUrl';
import { getSessionTurn } from '../services/sessions';
import { streamSpeech } from '../services/speech';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useMemoriesStore } from '../stores/useMemoriesStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useSessionStore } from '../stores/useSessionStore';
import { useTodosStore } from '../stores/useTodosStore';
import { describeCoachActivity } from '../utils/coachActivity';
import { waitForTurn } from '../utils/coachTurnRecovery';
import { VoiceController, type VoiceSnapshot } from '../utils/liveVoice/controller';

function requireSessionId(): string {
  const { sessionId } = useSessionStore.getState();
  if (!sessionId) throw new Error('There is no coaching session to talk in.');
  return sessionId;
}

// The coach may have changed real data during the turn; pull the stores back in line.
async function refreshData(): Promise<void> {
  try {
    await Promise.all([
      useHabitsStore.getState().loadHabits(),
      useGoalsStore.getState().loadGoals(),
      useTodosStore.getState().loadTodos(),
      useJournalStore.getState().loadEntries(),
      useDailyPlansStore.getState().loadPlan(getTodayDate()),
      useMemoriesStore.getState().loadMemories(),
    ]);
  } catch (error) {
    console.warn('Failed to refresh data after voice turn:', error);
  }
}

function createController(): VoiceController {
  return new VoiceController({
    audio: VoiceSession,
    transcribe: (uri) => transcribeAudio(uri),
    streamTurn: (prompt, onEvent) =>
      streamCoachTurn(
        {
          sessionId: requireSessionId(),
          prompt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userName: useProfileStore.getState().name || undefined,
          voice: true,
        },
        onEvent
      ),
    recoverTurn: (prompt) => {
      const sessionId = requireSessionId();
      return waitForTurn(prompt, () => getSessionTurn(sessionId));
    },
    fetchSpeech: streamSpeech,
    transcript: {
      addUser: async (content) => {
        await useSessionStore.getState().addMessage({ role: 'user', content, spoken: true });
      },
      startAssistant: (content) =>
        useSessionStore.getState().addLocalMessage({ role: 'assistant', content, spoken: true }),
      appendAssistant: (id, delta) => useSessionStore.getState().appendToMessage(id, delta),
      finalizeAssistant: (id, content) => useSessionStore.getState().finalizeMessage(id, content),
      addAssistant: async (content) => {
        await useSessionStore.getState().addMessage({ role: 'assistant', content, spoken: true });
      },
    },
    describeActivity: describeCoachActivity,
    explainTurnError: (error) => {
      console.warn('Voice turn failed:', error);
      Sentry.captureException(error, {
        tags: { feature: 'interactive-voice', stage: 'chat_generation' },
      });
      return getCoachRequestErrorMessage(error);
    },
    onTurnFinished: () => void refreshData(),
  });
}

/**
 * One interactive-mode session, alive for as long as the screen is. The
 * controller owns the audio engine, the turn loop and the speaker; leaving
 * the screen stops all of it and hands the audio session back.
 */
export function useLiveVoiceSession(): { snapshot: VoiceSnapshot; controller: VoiceController } {
  const controllerRef = useRef<VoiceController | null>(null);
  if (!controllerRef.current) controllerRef.current = createController();
  const controller = controllerRef.current;

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    return () => {
      void controller.stop();
    };
  }, [controller]);

  return { snapshot, controller };
}
