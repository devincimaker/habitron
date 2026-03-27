import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS, FONT_SIZES, type Colors } from '../constants/theme';
import { useThemedStyles, useColors } from '../hooks/useColors';

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
  const [styles, colors] = useThemedStyles(createStyles);
  const bars = 20;
  const animatedValues = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    // Animate bars based on meter level with some randomness for natural look
    animatedValues.forEach((anim, index) => {
      const centerDistance = Math.abs(index - bars / 2) / (bars / 2);
      const targetHeight = Math.max(
        0.15,
        level * (1 - centerDistance * 0.5) * (0.8 + Math.random() * 0.4)
      );

      Animated.timing(anim, {
        toValue: targetHeight,
        duration: 100,
        useNativeDriver: false,
      }).start();
    });
  }, [level, animatedValues]);

  const barColor = isWarning ? colors.error : colors.primary;

  return (
    <View style={waveformStyles.container}>
      {animatedValues.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            waveformStyles.bar,
            {
              backgroundColor: barColor,
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['15%', '100%'],
              }),
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Idle state - just the mic button
  if (mode === 'idle') {
    return (
      <TouchableOpacity
        style={styles.micButton}
        onPress={onMicPress}
        activeOpacity={0.7}
      >
        <Feather name="mic" size={24} color={colors.text} />
      </TouchableOpacity>
    );
  }

  // Transcribing state
  if (mode === 'transcribing') {
    return (
      <View style={styles.recordingContainer}>
        <ActivityIndicator color={colors.primary} />
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
      {/* Stop button */}
      <TouchableOpacity
        style={styles.stopButton}
        onPress={onStopPress}
        activeOpacity={0.7}
      >
        <View style={styles.stopIcon} />
      </TouchableOpacity>

      {/* Waveform and duration */}
      <View style={styles.waveformContainer}>
        <Waveform level={meterLevel} isWarning={isNearingLimit} />
        <Text style={[styles.durationText, isNearingLimit && styles.durationTextWarning]}>
          {durationDisplay}
        </Text>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={styles.sendButton}
        onPress={onSendPress}
        activeOpacity={0.7}
      >
        <Text style={styles.sendIcon}>↑</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  micButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  stopButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: BORDER_RADIUS.full,
  },
  stopIcon: {
    width: 14,
    height: 14,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  waveformContainer: {
    flex: 1,
    alignItems: 'center',
  },
  durationText: {
    fontSize: FONT_SIZES.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  durationTextWarning: {
    color: colors.error,
    fontWeight: '600',
  },
  sendButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.full,
  },
  sendIcon: {
    fontSize: 18,
    color: colors.white,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: colors.error,
  },
  retryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: {
    color: colors.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  transcribingText: {
    fontSize: FONT_SIZES.sm,
    color: colors.textSecondary,
    marginLeft: SPACING.sm,
  },
});
