import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';
import { useAudioRecorder } from './useAudioRecorder';
import { transcribeAudio } from '../services/api';
import type { VoiceMode, VoiceSessionState } from '../utils/voice';

type PendingAction = 'stop' | 'send' | null;

/** The recorder's readings plus the mic tap: what `VoiceControl` and `MicButton` need. */
type VoiceInputProps = VoiceSessionState & {
  onMicPress: () => void;
  onRetry: () => void;
};

interface UseVoiceInputOptions {
  /** Called when "send" is pressed after successful transcription */
  onSend?: (text: string) => Promise<void>;
  /** Called when "stop & edit" succeeds (including retry) - use to populate input field */
  onStopSuccess?: (text: string) => void;
}

interface UseVoiceInputReturn {
  /** Whether recording mode is active (recording or transcribing) */
  isRecordingMode: boolean;
  /** Whether transcription is in progress */
  isTranscribing: boolean;
  /** Recording duration in milliseconds */
  recordingDuration: number;
  /** Audio meter level (0-1) */
  meterLevel: number;
  /** Error message if any */
  error: string | null;
  /** Whether approaching recording limit */
  isNearingLimit: boolean;
  /** Maximum recording duration in milliseconds */
  maxDurationMs: number;

  /** Start recording */
  handleMicPress: () => Promise<void>;
  /** Stop recording and return transcribed text (for "stop & edit" flow) */
  handleStopRecording: () => Promise<string | null>;
  /** Stop recording, transcribe, and send directly */
  handleSendRecording: () => Promise<void>;
  /** Cancel recording mode and discard audio */
  handleCancelRecording: () => Promise<void>;
  /** Clear error and exit recording mode */
  handleRetryRecording: () => void;

  /** The recorder's readings, ready to spread into `VoiceControl` */
  voiceInputProps: VoiceInputProps;
}

function formatTranscriptionError(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to transcribe audio';
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onSend, onStopSuccess } = options;

  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [lastAudioUri, setLastAudioUri] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // Handle auto-stop at max duration - transcribe and put in input field
  const handleAutoStop = useCallback(async (audioUri: string) => {
    setIsTranscribing(true);
    setPendingAction('stop');
    setLastAudioUri(audioUri);
    try {
      const text = await transcribeAudio(audioUri);
      setLastAudioUri(null);
      setPendingAction(null);
      setIsRecordingMode(false);
      if (text.trim() && onStopSuccess) {
        onStopSuccess(text);
      }
    } catch (err) {
      console.error('Auto-stop transcription error:', err);
      Sentry.captureException(err, { tags: { feature: 'voice-transcription' } });
      setTranscriptionError(formatTranscriptionError(err));
    } finally {
      setIsTranscribing(false);
    }
  }, [onStopSuccess]);

  const {
    recordingDuration,
    meterLevel,
    isNearingLimit,
    maxDurationMs,
    startRecording,
    stopRecording,
    cancelRecording,
    error: recordingError,
  } = useAudioRecorder({
    onAutoStop: handleAutoStop,
  });

  const handleMicPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranscriptionError(null);
    setLastAudioUri(null);
    setPendingAction(null);
    setIsRecordingMode(true);
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async (): Promise<string | null> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const audioUri = await stopRecording();
    if (!audioUri) {
      setIsRecordingMode(false);
      return null;
    }

    setIsTranscribing(true);
    setPendingAction('stop');
    setLastAudioUri(audioUri);
    try {
      const text = await transcribeAudio(audioUri);
      setLastAudioUri(null);
      setPendingAction(null);
      setIsRecordingMode(false);
      return text;
    } catch (err) {
      console.error('Transcription error:', err);
      Sentry.captureException(err, { tags: { feature: 'voice-transcription' } });
      setTranscriptionError(formatTranscriptionError(err));
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording]);

  const handleSendRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const audioUri = await stopRecording();
    if (!audioUri) {
      setIsRecordingMode(false);
      return;
    }

    setIsTranscribing(true);
    setPendingAction('send');
    setLastAudioUri(audioUri);
    try {
      const text = await transcribeAudio(audioUri);
      setLastAudioUri(null);
      setPendingAction(null);
      setIsRecordingMode(false);

      if (text.trim() && onSend) {
        await onSend(text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      Sentry.captureException(err, { tags: { feature: 'voice-transcription' } });
      setTranscriptionError(formatTranscriptionError(err));
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording, onSend]);

  const handleRetryRecording = useCallback(async () => {
    // If we have a saved audio URI, retry transcription
    if (lastAudioUri) {
      setTranscriptionError(null);
      setIsTranscribing(true);
      try {
        const text = await transcribeAudio(lastAudioUri);
        setLastAudioUri(null);
        setIsRecordingMode(false);

        // Execute the original action
        if (pendingAction === 'send' && text.trim() && onSend) {
          await onSend(text);
        } else if (pendingAction === 'stop' && text.trim() && onStopSuccess) {
          onStopSuccess(text);
        }
        setPendingAction(null);
      } catch (err) {
        console.error('Retry transcription error:', err);
        Sentry.captureException(err, { tags: { feature: 'voice-transcription' } });
        setTranscriptionError(formatTranscriptionError(err));
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // No saved audio, just reset
      setTranscriptionError(null);
      setPendingAction(null);
      setIsRecordingMode(false);
    }
  }, [lastAudioUri, pendingAction, onSend, onStopSuccess]);

  // Combined error from recording or transcription
  const error = transcriptionError || recordingError;

  const handleCancelRecording = useCallback(async () => {
    setTranscriptionError(null);
    setLastAudioUri(null);
    setPendingAction(null);
    setIsTranscribing(false);
    setIsRecordingMode(false);
    await cancelRecording();
  }, [cancelRecording]);

  function computeMode(): VoiceMode {
    if (!isRecordingMode) return 'idle';
    if (isTranscribing) return 'transcribing';
    return 'recording';
  }
  const mode = computeMode();

  const voiceInputProps: VoiceInputProps = {
    mode,
    meterLevel,
    recordingDuration,
    maxDurationMs,
    isNearingLimit,
    error,
    onMicPress: handleMicPress,
    onRetry: handleRetryRecording,
  };

  return {
    isRecordingMode,
    isTranscribing,
    recordingDuration,
    meterLevel,
    error,
    isNearingLimit,
    maxDurationMs,
    handleMicPress,
    handleStopRecording,
    handleSendRecording,
    handleCancelRecording,
    handleRetryRecording,
    voiceInputProps,
  };
}
