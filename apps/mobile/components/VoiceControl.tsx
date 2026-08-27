import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Caption, Label } from './ui';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { formatElapsed } from '../utils/instruct';
import {
  pushLevelHistory,
  toVoiceControlMode,
  type VoiceSessionState,
} from '../utils/voice';

interface VoiceControlProps extends VoiceSessionState {
  onDiscard: () => void;
  onStop: () => void;
  onRetry: () => void;
  /** Surfaces that can send get the ↑ slot, held across every state. */
  onSend?: () => void;
}

const PILL_HEIGHT = 40;
const SLOT_SIZE = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_COUNT = 24;
const WAVE_HEIGHT = 24;
const STOP_SQUARE = 14;
const BAR_INDICES = Array.from({ length: BAR_COUNT }, (_, index) => index);
/** A silent sample still draws as a dot: the bar at its narrowest. */
const MIN_BAR_SCALE = BAR_WIDTH / WAVE_HEIGHT;

/**
 * One pill for every voice state, so nothing moves between them: ✕ discards
 * the audio, ■ stops and lands the text, ↑ (when the surface can send) stops
 * and sends. Transcribing and failed states keep every slot where it was.
 */
export function VoiceControl({
  mode,
  error,
  meterLevel,
  recordingDuration,
  maxDurationMs,
  isNearingLimit,
  onDiscard,
  onStop,
  onRetry,
  onSend,
}: VoiceControlProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const state = toVoiceControlMode(mode, error);

  // One sample per recorder tick, taken while rendering so the tick costs
  // one commit, not a render plus an effect's re-render.
  const [history, setHistory] = useState<number[]>([]);
  const [sampledTick, setSampledTick] = useState(-1);
  if (state === 'recording' && recordingDuration !== sampledTick) {
    setSampledTick(recordingDuration);
    setHistory(pushLevelHistory(history, meterLevel, BAR_COUNT));
  }

  // A failure straight out of the recorder (permission, start, stop) never
  // had audio to keep; only a failure after transcribing began did.
  const wasTranscribingRef = useRef(false);
  useEffect(() => {
    if (state === 'transcribing') wasTranscribingRef.current = true;
    else if (state === 'recording') wasTranscribingRef.current = false;
  }, [state]);
  const audioKept = wasTranscribingRef.current;

  if (state === 'idle') return null;

  const accent = isNearingLimit ? colors.error : colors.text;
  let wave: ReactNode;
  let caption: string;
  let captionColor = colors.textSecondary;
  if (state === 'recording') {
    wave = BAR_INDICES.map((index) => {
      const level = history[index] ?? 0;
      return (
        <View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: level > 0 ? accent : colors.border,
              transform: [{ scaleY: Math.max(MIN_BAR_SCALE, level) }],
            },
          ]}
        />
      );
    });
    caption = `${formatElapsed(recordingDuration)} / ${formatElapsed(maxDurationMs)}`;
    if (isNearingLimit) captionColor = colors.error;
  } else if (state === 'transcribing') {
    wave = <ActivityIndicator size="small" color={colors.primary} />;
    caption = 'Transcribing…';
  } else {
    wave = (
      <Label color={colors.error} numberOfLines={1}>
        {audioKept ? 'Transcription failed' : error}
      </Label>
    );
    caption = audioKept ? 'Audio kept' : '';
  }

  return (
    <View style={styles.pill}>
      <Pressable
        style={styles.slotCircle}
        onPress={onDiscard}
        accessibilityRole="button"
        accessibilityLabel="Discard recording"
      >
        <Feather name="x" size={16} color={colors.text} />
      </Pressable>

      <View style={styles.stack}>
        <View style={styles.waveRow}>{wave}</View>
        <Caption color={captionColor} style={styles.caption} numberOfLines={1}>
          {caption}
        </Caption>
      </View>

      <View style={styles.slot}>
        {state === 'recording' ? (
          <Pressable
            style={styles.slotCircle}
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
          >
            <View style={styles.stopSquare} />
          </Pressable>
        ) : state === 'error' ? (
          <Pressable
            style={[styles.slotCircle, styles.primaryCircle]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry transcription"
          >
            <Feather name="rotate-ccw" size={16} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      {onSend ? (
        <Pressable
          style={[
            styles.slotCircle,
            styles.primaryCircle,
            state !== 'recording' && styles.heldSlot,
          ]}
          onPress={onSend}
          disabled={state !== 'recording'}
          accessibilityRole="button"
          accessibilityLabel="Send recording"
        >
          <Feather name="arrow-up" size={18} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  pill: {
    flex: 1,
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BORDER_RADIUS.full,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
  },
  slotCircle: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
  },
  primaryCircle: {
    backgroundColor: colors.primary,
  },
  heldSlot: {
    opacity: 0.4,
  },
  stack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRow: {
    height: WAVE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    height: WAVE_HEIGHT,
    borderRadius: BAR_WIDTH / 2,
  },
  stopSquare: {
    width: STOP_SQUARE,
    height: STOP_SQUARE,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  caption: {
    lineHeight: 12,
  },
});
