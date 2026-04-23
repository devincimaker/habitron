import { useState, useRef, useCallback, useEffect } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';

const MAX_RECORDING_DURATION_MS = 4 * 60 * 1000; // 4 minutes
const WARNING_THRESHOLD_MS = 3.5 * 60 * 1000; // 30 seconds before limit
const METERING_INTERVAL_MS = 100;

const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

interface UseAudioRecorderOptions {
  /** Called when recording auto-stops at max duration, with the audio URI */
  onAutoStop?: (audioUri: string) => void;
}

interface UseAudioRecorderResult {
  isRecording: boolean;
  recordingDuration: number;
  meterLevel: number; // 0-1 normalized
  isNearingLimit: boolean; // true when < 30 seconds remain
  maxDurationMs: number; // expose max duration for UI
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // Returns audio URI
  cancelRecording: () => Promise<void>;
  error: string | null;
}

type ExpoAudioRecorder = ReturnType<typeof useExpoAudioRecorder>;

function getRecorderStatus(
  recorder: ExpoAudioRecorder,
  context: string
) {
  try {
    return recorder.getStatus();
  } catch (error) {
    console.warn(`Failed to read recorder status during ${context}:`, error);
    return null;
  }
}

function getRecorderUri(
  recorder: ExpoAudioRecorder,
  context: string
): string | null {
  return recorder.uri ?? getRecorderStatus(recorder, context)?.url ?? null;
}

async function disableRecordingAudioMode(context: string): Promise<void> {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
    });
  } catch (error) {
    console.warn(`Failed to reset audio mode during ${context}:`, error);
  }
}

async function stopRecorderForCleanup(
  recorder: ExpoAudioRecorder,
  context: string
): Promise<void> {
  try {
    await recorder.stop();
  } catch (error) {
    console.warn(`Failed to stop recorder during ${context}:`, error);
  }
}

function normalizeMeterLevel(metering?: number): number {
  if (metering === undefined) {
    return 0;
  }

  // Convert dB to 0-1 range (typically around -160 to 0 dB).
  return Math.max(0, Math.min(1, (metering + 60) / 60));
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderResult {
  const { onAutoStop } = options;
  const recorder = useExpoAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, METERING_INTERVAL_MS);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [isNearingLimit, setIsNearingLimit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAutoStopRef = useRef(onAutoStop);
  const hasTriggeredWarningRef = useRef(false);
  const hasTriggeredAutoStopRef = useRef(false);

  onAutoStopRef.current = onAutoStop;

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setRecordingDuration(0);
    setMeterLevel(0);
    setIsNearingLimit(false);
    hasTriggeredWarningRef.current = false;
    hasTriggeredAutoStopRef.current = false;
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!isRecording) {
      resetRecordingState();
      return null;
    }

    try {
      await recorder.stop();
      const uri = getRecorderUri(recorder, 'stop');

      await setAudioModeAsync({
        allowsRecording: false,
      });

      resetRecordingState();
      return uri;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      Sentry.captureException(err, { tags: { feature: 'voice-recording' } });

      const savedUri = getRecorderUri(recorder, 'stop after failure');

      await disableRecordingAudioMode('stop after failure');

      resetRecordingState();

      if (savedUri) {
        console.warn('Recording stop error, but URI preserved:', savedUri);
        return savedUri;
      }

      setError('Failed to stop recording');
      return null;
    }
  }, [isRecording, recorder, resetRecordingState]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      hasTriggeredWarningRef.current = false;
      hasTriggeredAutoStopRef.current = false;
      setRecordingDuration(0);
      setMeterLevel(0);
      setIsNearingLimit(false);

      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required');
        setIsRecording(false);
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Sentry.captureException(err, { tags: { feature: 'voice-recording' } });
      await disableRecordingAudioMode('start');
      setError('Failed to start recording');
      resetRecordingState();
    }
  }, [recorder, resetRecordingState]);

  const cancelRecording = useCallback(async () => {
    setError(null);

    if (isRecording || getRecorderStatus(recorder, 'cancel')?.isRecording) {
      await stopRecorderForCleanup(recorder, 'cancel');
    }

    await disableRecordingAudioMode('cancel');

    resetRecordingState();
  }, [isRecording, recorder, resetRecordingState]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    setRecordingDuration(recorderState.durationMillis);
    setMeterLevel(normalizeMeterLevel(recorderState.metering));

    if (
      recorderState.durationMillis >= WARNING_THRESHOLD_MS &&
      !hasTriggeredWarningRef.current
    ) {
      hasTriggeredWarningRef.current = true;
      setIsNearingLimit(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    if (
      recorderState.durationMillis >= MAX_RECORDING_DURATION_MS &&
      !hasTriggeredAutoStopRef.current
    ) {
      hasTriggeredAutoStopRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void stopRecording().then((uri) => {
        if (uri && onAutoStopRef.current) {
          onAutoStopRef.current(uri);
        }
      });
    }
  }, [
    isRecording,
    recorderState.durationMillis,
    recorderState.metering,
    stopRecording,
  ]);

  useEffect(() => {
    return () => {
      if (getRecorderStatus(recorder, 'cleanup')?.isRecording) {
        void stopRecorderForCleanup(recorder, 'cleanup');
      }

      void disableRecordingAudioMode('cleanup');
    };
  }, [recorder]);

  return {
    isRecording,
    recordingDuration,
    meterLevel,
    isNearingLimit,
    maxDurationMs: MAX_RECORDING_DURATION_MS,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  };
}
