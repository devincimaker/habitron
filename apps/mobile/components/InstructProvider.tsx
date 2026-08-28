import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';
import { getTodayDate, type CoachInstructRequest } from '@habits-coach/shared';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { TranscriptionTimeoutError, streamInstructTurn, transcribeAudio } from '../services/api';
import { getCoachRequestErrorMessage } from '../services/apiUrl';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useTodosStore } from '../stores/useTodosStore';
import { describeCoachActivity } from '../utils/coachActivity';
import {
  INITIAL_INSTRUCT_STATE,
  TOAST_MS,
  canAbort,
  canHold,
  holdOutcome,
  instructReducer,
  parseProposal,
  type InstructAction,
  type InstructState,
} from '../utils/instruct';
import { InstructOverlay } from './InstructOverlay';

/** What the Coach tab's hold gesture drives. */
export interface InstructHold {
  start: () => void;
  /** How far the finger has risen above where the hold began, in points. */
  move: (lift: number) => void;
  /** `released` is false when the gesture was cancelled rather than lifted. */
  end: (released: boolean) => void;
}

interface InstructContextValue {
  state: InstructState;
  hold: InstructHold;
  /** Stop a working turn and return to whatever the hold interrupted. */
  abort: () => void;
}

const InstructContext = createContext<InstructContextValue | null>(null);

export function useInstruct(): InstructContextValue {
  const value = useContext(InstructContext);
  if (!value) throw new Error('useInstruct must be used within InstructProvider');
  return value;
}

type TurnRequest = Omit<CoachInstructRequest, 'timezone' | 'userName'>;

/**
 * Owns hold-to-instruct: the recorder, the turns against /api/instruct, and
 * the sheet. Wraps the tab navigator so the tab bar (inside it) can drive the
 * hold while the overlay renders above the screens and below the tab bar.
 */
export function InstructProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(instructReducer, INITIAL_INSTRUCT_STATE);
  /** Never assigned from render: `send` is the only writer. See below. */
  const stateRef = useRef(INITIAL_INSTRUCT_STATE);

  /**
   * Dispatch, and advance the ref in the same breath, so a gesture or async
   * callback reading `stateRef` sees what it just dispatched rather than what
   * React last rendered. A flick that arms cancel and releases in one tick is
   * the case that matters. `instructReducer` is pure, so mirroring it is safe.
   */
  const send = useCallback((action: InstructAction) => {
    stateRef.current = instructReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  const submitRef = useRef<(audioUri?: string) => Promise<void>>(async () => {});
  /** Whether a hold is still driving the recorder — not whether a finger is down. */
  const holdingRef = useRef(false);
  const recorder = useAudioRecorder({
    // At the recording limit the recorder hands its file straight to `submit`,
    // so the hold has stopped driving anything and the release still to come
    // has nothing left to do. Clearing the flag is what makes `end` return at
    // its guard: left set, that release submitted a second time, aborting the
    // turn carrying the four minutes and reporting them as "Didn't catch that".
    onAutoStop: (uri) => {
      holdingRef.current = false;
      void submitRef.current(uri);
    },
  });
  // A render mirror is right here, unlike the one `send` replaced: this is the
  // recorder handle itself, not state a callback could read a stale copy of.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  /** The in-flight `startRecording`, so a release never races the start. */
  const startingRef = useRef<Promise<void>>(Promise.resolve());
  /** The in-flight turn's controller: aborting it is also what orphans its results. */
  const abortRef = useRef<AbortController | null>(null);

  const userName = useProfileStore((s) => s.name);
  const loadHabits = useHabitsStore((s) => s.loadHabits);
  const loadGoals = useGoalsStore((s) => s.loadGoals);
  const loadTodos = useTodosStore((s) => s.loadTodos);
  const loadEntries = useJournalStore((s) => s.loadEntries);
  const loadPlan = useDailyPlansStore((s) => s.loadPlan);

  // An applied instruction changed real data; pull the app's stores back in line.
  const refreshData = useCallback(async () => {
    try {
      await Promise.all([loadHabits(), loadGoals(), loadTodos(), loadEntries(), loadPlan(getTodayDate())]);
    } catch (error) {
      console.warn('Failed to refresh data after instruction:', error);
    }
  }, [loadEntries, loadGoals, loadHabits, loadPlan, loadTodos]);

  const runTurn = useCallback(
    async (
      request: TurnRequest,
      signal?: AbortSignal
    ): Promise<{ text: string; error: string | null }> => {
      let streamed = '';
      let finalText: string | null = null;
      let error: string | null = null;

      try {
        await streamInstructTurn(
          {
            ...request,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            userName: userName || undefined,
          },
          (event) => {
            // A turn that was aborted or overtaken must not paint anything,
            // including the session id a later correction would resume.
            if (signal?.aborted) return;
            switch (event.type) {
              case 'session':
                send({ type: 'session', claudeSessionId: event.claudeSessionId });
                break;
              case 'tool':
                send({ type: 'activity', label: describeCoachActivity(event.name) });
                break;
              case 'text':
                streamed += event.delta;
                break;
              case 'done':
                finalText = event.message;
                break;
              case 'error':
                error = event.message;
                break;
            }
          },
          signal
        );
      } catch (caught) {
        // An abort is a deliberate cancel, not a failure: silent, unreported.
        if (signal?.aborted) return { text: '', error: null };
        console.warn('Instruction turn failed:', caught);
        Sentry.captureException(caught, {
          tags: { feature: 'instruct', stage: 'chat_generation' },
          extra: { kind: request.kind },
        });
        error = getCoachRequestErrorMessage(caught);
      }

      return { text: finalText ?? streamed, error };
    },
    [send, userName]
  );

  const submit = useCallback(
    async (audioUri?: string) => {
      const { correcting, claudeSessionId } = stateRef.current;
      // One mechanism for both jobs: a new turn orphans whatever is still
      // running, and the same signal is what every later dispatch checks.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      send({ type: 'submit' });

      await startingRef.current;
      const uri = audioUri ?? (await recorderRef.current.stopRecording());
      let transcript = '';
      if (uri) {
        try {
          transcript = (await transcribeAudio(uri, signal)).trim();
        } catch (error) {
          if (signal.aborted) return;
          console.warn('Transcription failed:', error);
          Sentry.captureException(error, { tags: { feature: 'instruct', stage: 'transcription' } });
          // A dead server is not a misheard sentence. Falling through would
          // leave the transcript empty and say "Didn't catch that", inviting an
          // immediate retry against the thing that just timed out.
          if (error instanceof TranscriptionTimeoutError) {
            send({ type: 'notice', message: error.message });
            return;
          }
        }
      }
      if (signal.aborted) return;
      if (!transcript) {
        send({ type: 'nothing-heard' });
        return;
      }

      const request: TurnRequest =
        correcting && claudeSessionId
          ? { kind: 'correct', text: transcript, claudeSessionId }
          : { kind: 'propose', text: transcript };
      const { text, error } = await runTurn(request, signal);
      if (signal.aborted) return;
      if (error) {
        send({ type: 'notice', message: error, transcript });
        return;
      }

      const outcome = parseProposal(text);
      send(
        outcome.kind === 'proposal'
          ? { type: 'proposal', transcript, proposal: outcome.proposal }
          : { type: 'notice', message: outcome.message, transcript }
      );
    },
    [runTurn, send]
  );
  submitRef.current = submit;

  const apply = useCallback(async () => {
    const { phase, claudeSessionId } = stateRef.current;
    if (phase !== 'proposal' || !claudeSessionId) return;
    send({ type: 'apply' });

    const { error } = await runTurn({ kind: 'apply', claudeSessionId });
    await refreshData();
    if (error) {
      send({ type: 'notice', message: error });
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    send({ type: 'applied' });
  }, [refreshData, runTurn, send]);

  const dismiss = useCallback(() => send({ type: 'dismiss' }), [send]);

  const abort = useCallback(() => {
    if (!canAbort(stateRef.current)) return;
    abortRef.current?.abort();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    send({ type: 'abort' });
  }, [send]);

  // Stable handlers: the gesture holds on to whatever it was given when the hold began.
  const hold = useMemo<InstructHold>(
    () => ({
      start: () => {
        if (holdingRef.current || !canHold(stateRef.current)) return;
        holdingRef.current = true;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        send({ type: 'hold-start' });
        startingRef.current = recorderRef.current.startRecording();
      },
      move: (lift) => {
        if (!holdingRef.current) return;
        send({ type: 'hold-move', lift });
      },
      end: (released) => {
        if (!holdingRef.current) return;
        holdingRef.current = false;
        if (holdOutcome(released, stateRef.current) === 'cancel') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          send({ type: 'hold-cancel' });
          void startingRef.current.then(() => recorderRef.current.cancelRecording());
        } else {
          void submitRef.current();
        }
      },
    }),
    [send]
  );

  useEffect(() => {
    if (state.phase !== 'toast') return;
    const timer = setTimeout(() => send({ type: 'toast-expired' }), TOAST_MS);
    return () => clearTimeout(timer);
  }, [send, state.phase]);

  const value = useMemo(() => ({ state, hold, abort }), [state, hold, abort]);

  return (
    <InstructContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        <InstructOverlay
          state={state}
          meterLevel={recorder.meterLevel}
          recordingDuration={recorder.recordingDuration}
          onApply={apply}
          onDismiss={dismiss}
          onAbort={abort}
        />
      </View>
    </InstructContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
