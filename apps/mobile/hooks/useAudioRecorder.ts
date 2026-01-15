import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export const MAX_RECORDING_DURATION_MS = 4 * 60 * 1000; // 4 minutes
export const WARNING_THRESHOLD_MS = 3.5 * 60 * 1000; // 30 seconds before limit
const METERING_INTERVAL_MS = 100;

// Custom recording options that produce m4a format (supported by OpenAI Whisper)
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
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

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderResult {
  const { onAutoStop } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [isNearingLimit, setIsNearingLimit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasTriggeredWarningRef = useRef(false);
  const onAutoStopRef = useRef(onAutoStop);

  // Keep ref updated with latest callback
  onAutoStopRef.current = onAutoStop;

  const clearIntervals = useCallback(() => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    clearIntervals();

    if (!recordingRef.current) {
      setIsRecording(false);
      setIsNearingLimit(false);
      return null;
    }

    // Anti-fragile: Save URI before attempting unload
    const savedUri = recordingRef.current.getURI();

    try {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      setIsRecording(false);
      setIsNearingLimit(false);
      setMeterLevel(0);

      return savedUri;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      // Even if unload fails, we preserved the URI
      recordingRef.current = null;
      setIsRecording(false);
      setIsNearingLimit(false);
      setMeterLevel(0);

      // Return saved URI even on error - audio file may still be valid
      if (savedUri) {
        console.warn('Recording unload error, but URI preserved:', savedUri);
        return savedUri;
      }

      setError('Failed to stop recording');
      return null;
    }
  }, [clearIntervals]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and prepare recording with m4a format (supported by OpenAI Whisper)
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      hasTriggeredWarningRef.current = false;
      setIsRecording(true);
      setRecordingDuration(0);
      setIsNearingLimit(false);

      // Start metering interval
      meteringIntervalRef.current = setInterval(async () => {
        if (recordingRef.current) {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // Convert dB to 0-1 range (typically -160 to 0 dB)
            const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
            setMeterLevel(normalized);
          }
        }
      }, METERING_INTERVAL_MS);

      // Start duration tracking
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setRecordingDuration(elapsed);

        // Warning state when approaching limit (30 seconds before)
        if (elapsed >= WARNING_THRESHOLD_MS && !hasTriggeredWarningRef.current) {
          hasTriggeredWarningRef.current = true;
          setIsNearingLimit(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        // Auto-stop at max duration
        if (elapsed >= MAX_RECORDING_DURATION_MS) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          stopRecording().then((uri) => {
            if (uri && onAutoStopRef.current) {
              onAutoStopRef.current(uri);
            }
          });
        }
      }, 100);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
      setIsRecording(false);
    }
  }, [stopRecording]);

  const cancelRecording = useCallback(async () => {
    clearIntervals();

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore errors when canceling
      }
      recordingRef.current = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    setIsRecording(false);
    setIsNearingLimit(false);
    setMeterLevel(0);
    setRecordingDuration(0);
  }, [clearIntervals]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearIntervals();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [clearIntervals]);

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
