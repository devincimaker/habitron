import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';
import { useAudioRecorder } from './useAudioRecorder';
import { transcribeAudio } from '../services/api';

type VoiceInputMode = 'idle' | 'recording' | 'transcribing';
type PendingAction = 'stop' | 'send' | null;

interface VoiceInputButtonProps {
  mode: VoiceInputMode;
  meterLevel: number;
  recordingDuration: number;
  maxDurationMs: number;
  isNearingLimit: boolean;
  error: string | null;
  onMicPress: () => void;
  onStopPress: () => void;
  onSendPress: () => void;
  onRetry: () => void;
}

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
  /** Clear error and exit recording mode */
  handleRetryRecording: () => void;

  /** Props object ready to spread to VoiceInputButton */
  voiceInputProps: VoiceInputButtonProps;
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

  // Helper to handle transcription with consistent error handling
  const transcribeWithErrorHandling = useCallback(async (
    audioUri: string,
    onSuccess: (text: string) => void | Promise<void>,
    errorPrefix = 'Transcription'
  ): Promise<string | null> => {
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(audioUri);
      await onSuccess(text);
      return text;
    } catch (err) {
      console.error(`${errorPrefix} error:`, err);
      Sentry.captureException(err, { tags: { feature: 'voice-transcription' } });
      setTranscriptionError(formatTranscriptionError(err));
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // Handle auto-stop at max duration - transcribe and put in input field
  const handleAutoStop = useCallback(async (audioUri: string) => {
    setPendingAction('stop');
    setLastAudioUri(audioUri);
    await transcribeWithErrorHandling(audioUri, (text) => {
      setLastAudioUri(null);
      setPendingAction(null);
      setIsRecordingMode(false);
      if (text.trim() && onStopSuccess) {
        onStopSuccess(text);
      }
    }, 'Auto-stop transcription');
  }, [onStopSuccess, transcribeWithErrorHandling]);

  const {
    recordingDuration,
    meterLevel,
    isNearingLimit,
    maxDurationMs,
    startRecording,
    stopRecording,
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

    setPendingAction('stop');
    setLastAudioUri(audioUri);
    return await transcribeWithErrorHandling(audioUri, (text) => {
      setLastAudioUri(null);
      setPendingAction(null);
      setIsRecordingMode(false);
    });
  }, [stopRecording, transcribeWithErrorHandling]);

  const handleSendRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const audioUri = await stopRecording();
    if (!audioUri) {
      setIsRecordingMode(false);
      return;
    }

    setPendingAction('send');
    setLastAudioUri(audioUri);
    await transcribeWithErrorHandling(audioUri, async (text) => {
      setLastAudioUri(null);
      setPendingAction(null);
      setIsRecordingMode(false);

      if (text.trim() && onSend) {
        await onSend(text);
      }
    });
  }, [stopRecording, onSend, transcribeWithErrorHandling]);

  const handleRetryRecording = useCallback(async () => {
    // If we have a saved audio URI, retry transcription
    if (lastAudioUri) {
      setTranscriptionError(null);
      await transcribeWithErrorHandling(lastAudioUri, async (text) => {
        setLastAudioUri(null);
        setIsRecordingMode(false);

        // Execute the original action
        if (pendingAction === 'send' && text.trim() && onSend) {
          await onSend(text);
        } else if (pendingAction === 'stop' && text.trim() && onStopSuccess) {
          onStopSuccess(text);
        }
        setPendingAction(null);
      }, 'Retry transcription');
    } else {
      // No saved audio, just reset
      setTranscriptionError(null);
      setPendingAction(null);
      setIsRecordingMode(false);
    }
  }, [lastAudioUri, pendingAction, onSend, onStopSuccess, transcribeWithErrorHandling]);

  // Combined error from recording or transcription
  const error = transcriptionError || recordingError;

  // Compute mode for VoiceInputButton
  function computeMode(): VoiceInputMode {
    if (!isRecordingMode) return 'idle';
    if (isTranscribing) return 'transcribing';
    return 'recording';
  }
  const mode = computeMode();

  // Props object ready to spread to VoiceInputButton
  const voiceInputProps: VoiceInputButtonProps = {
    mode,
    meterLevel,
    recordingDuration,
    maxDurationMs,
    isNearingLimit,
    error,
    onMicPress: handleMicPress,
    onStopPress: handleStopRecording,
    onSendPress: handleSendRecording,
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
    handleRetryRecording,
    voiceInputProps,
  };
}
