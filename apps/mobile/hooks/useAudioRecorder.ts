import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

const MAX_RECORDING_DURATION_MS = 4 * 60 * 1000; // 4 minutes
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

interface UseAudioRecorderResult {
  isRecording: boolean;
  recordingDuration: number;
  meterLevel: number; // 0-1 normalized
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // Returns audio URI
  cancelRecording: () => Promise<void>;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

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
      return null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      setIsRecording(false);
      setMeterLevel(0);

      return uri;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Failed to stop recording');
      setIsRecording(false);
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
      setIsRecording(true);
      setRecordingDuration(0);

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

        // Auto-stop at max duration
        if (elapsed >= MAX_RECORDING_DURATION_MS) {
          stopRecording();
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
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  };
}
