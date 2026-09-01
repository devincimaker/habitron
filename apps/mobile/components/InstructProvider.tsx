import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useInstructLogStore } from '../stores/useInstructLogStore';
import {
  INITIAL_INSTRUCT_STATE,
  canHold,
  holdOutcome,
  instructReducer,
  type InstructAction,
  type InstructState,
} from '../utils/instruct';
import { CoachActivitySheet } from './CoachActivitySheet';
import { InstructOverlay } from './InstructOverlay';
import { InstructTickerPill } from './InstructTickerPill';

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
}

const InstructContext = createContext<InstructContextValue | null>(null);

export function useInstruct(): InstructContextValue {
  const value = useContext(InstructContext);
  if (!value) throw new Error('useInstruct must be used within InstructProvider');
  return value;
}

/**
 * Owns hold-to-instruct's gesture and recorder. Release fires and forgets:
 * the recording goes to the queue store, which uploads it and re-derives all
 * later UI — the ticker pill, the activity sheet — from the server's log.
 * Wraps the tab navigator so the tab bar (inside it) can drive the hold while
 * the overlay renders above the screens and below the tab bar.
 */
export function InstructProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(instructReducer, INITIAL_INSTRUCT_STATE);
  /** Never assigned from render: `send` is the only writer. See below. */
  const stateRef = useRef(INITIAL_INSTRUCT_STATE);

  /**
   * Dispatch, and advance the ref in the same breath, so a gesture callback
   * reading `stateRef` sees what it just dispatched rather than what React
   * last rendered. A flick that arms cancel and releases in one tick is the
   * case that matters. `instructReducer` is pure, so mirroring it is safe.
   */
  const send = useCallback((action: InstructAction) => {
    stateRef.current = instructReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  const submit = useInstructLogStore((s) => s.submit);
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const recorder = useAudioRecorder({
    onAutoStop: (uri) => {
      if (uri) void submitRef.current(uri);
    },
  });
  // A render mirror is right here, unlike the one `send` replaced: this is the
  // recorder handle itself, not state a callback could read a stale copy of.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  /** The in-flight `startRecording`, so a release never races the start. */
  const startingRef = useRef<Promise<void>>(Promise.resolve());
  const holdingRef = useRef(false);

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
          send({ type: 'submit' });
          // The thumb may lift and the phone may lock: the only client
          // obligation left is this upload, which the store owns.
          void startingRef.current.then(async () => {
            const uri = await recorderRef.current.stopRecording();
            if (uri) void submitRef.current(uri);
          });
        }
      },
    }),
    [send]
  );

  const value = useMemo(() => ({ state, hold }), [state, hold]);

  return (
    <InstructContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        <InstructOverlay
          state={state}
          meterLevel={recorder.meterLevel}
          recordingDuration={recorder.recordingDuration}
        />
        <InstructTickerPill recording={state.phase === 'recording'} />
        <CoachActivitySheet />
      </View>
    </InstructContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
