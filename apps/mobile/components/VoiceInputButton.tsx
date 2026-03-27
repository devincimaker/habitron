import React, { useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

interface VoiceInputButtonProps {
  // Idle state (just the mic button)
  mode: 'idle' | 'recording' | 'transcribing';
  onMicPress: () => void;
  // Recording state
  meterLevel?: number; // 0-1
  recordingDuration?: number; // ms
  maxDurationMs?: number; // max recording duration for display
  isNearingLimit?: boolean; // true when approaching time limit
  onStopPress?: () => void;
  onSendPress?: () => void;
  // Error state
  error?: string | null;
  onRetry?: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Waveform visualization component
function Waveform({ level, isWarning = false }: { level: number; isWarning?: boolean }) {
  const bars = 20;
  const animatedValues = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    animatedValues.forEach((anim, index) => {
      const centerDistance = Math.abs(index - bars / 2) / (bars / 2);
      const targetScale = Math.max(
        0.15,
        level * (1 - centerDistance * 0.5) * (0.8 + Math.random() * 0.4)
      );

      Animated.timing(anim, {
        toValue: targetScale,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [level, animatedValues]);

  const barColor = isWarning ? COLORS.error : COLORS.primary;

  return (
    <View style={waveformStyles.container}>
      {animatedValues.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            waveformStyles.bar,
            {
              backgroundColor: barColor,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const waveformStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    gap: 2,
  },
  bar: {
    width: 3,
    height: 40,
    borderRadius: 1.5,
  },
});

export function VoiceInputButton({
  mode,
  onMicPress,
  meterLevel = 0,
  recordingDuration = 0,
  maxDurationMs,
  isNearingLimit = false,
  onStopPress,
  onSendPress,
  error,
  onRetry,
}: VoiceInputButtonProps) {
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Idle state - just the mic button
  if (mode === 'idle') {
    return (
      <Pressable
        style={styles.micButton}
        onPress={onMicPress}
        accessibilityLabel="Start voice recording"
        accessibilityRole="button"
      >
        <Feather name="mic" size={24} color={COLORS.text} />
      </Pressable>
    );
  }

  // Transcribing state
  if (mode === 'transcribing') {
    return (
      <View style={styles.recordingContainer}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.transcribingText}>Transcribing...</Text>
      </View>
    );
  }

  // Recording state - full recording interface
  const durationDisplay = maxDurationMs
    ? `${formatDuration(recordingDuration)} / ${formatDuration(maxDurationMs)}`
    : formatDuration(recordingDuration);

  return (
    <View style={styles.recordingContainer}>
      <Pressable
        style={styles.stopButton}
        onPress={onStopPress}
        accessibilityLabel="Stop recording"
        accessibilityRole="button"
      >
        <View style={styles.stopIcon} />
      </Pressable>

      <View style={styles.waveformContainer}>
        <Waveform level={meterLevel} isWarning={isNearingLimit} />
        <Text style={[styles.durationText, isNearingLimit && styles.durationTextWarning]}>
          {durationDisplay}
        </Text>
      </View>

      <Pressable
        style={styles.sendButton}
        onPress={onSendPress}
        accessibilityLabel="Send recording"
        accessibilityRole="button"
      >
        <Text style={styles.sendIcon}>↑</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  stopButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
  },
  stopIcon: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
  waveformContainer: {
    flex: 1,
    alignItems: 'center',
  },
  durationText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  durationTextWarning: {
    color: COLORS.error,
    fontWeight: '600',
  },
  sendButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
  },
  sendIcon: {
    fontSize: 18,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
  },
  retryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  transcribingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
});
