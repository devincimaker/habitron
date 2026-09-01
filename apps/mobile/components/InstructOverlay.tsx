import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, SHADOWS, SPACING, TAB_BAR, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useInstructLogStore } from '../stores/useInstructLogStore';
import { formatElapsed, holdHint, type InstructState } from '../utils/instruct';
import { Waveform } from './Waveform';

interface InstructOverlayProps {
  state: InstructState;
  meterLevel: number;
  recordingDuration: number;
}

/**
 * The capture panel a hold puts on screen: scrim and waveform, rising from
 * the tab bar. Release dismisses it immediately — everything after is queue
 * state, narrated by the ticker pill.
 */
export function InstructOverlay({ state, meterLevel, recordingDuration }: InstructOverlayProps) {
  const [styles] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reinstructing = useInstructLogStore((s) => s.reinstructOf !== null);

  if (state.phase !== 'recording') return null;

  return (
    <View
      style={[styles.container, { bottom: TAB_BAR.height + insets.bottom }]}
      pointerEvents="box-none"
      testID="instruct-overlay"
    >
      <View style={styles.scrim} pointerEvents="none" />
      <View style={styles.panel}>
        <Waveform level={meterLevel} isWarning={state.cancelArmed} />
        <Text style={styles.elapsed}>{formatElapsed(recordingDuration)}</Text>
        <Text style={[styles.hint, state.cancelArmed && styles.hintWarning]}>
          {holdHint(state, reinstructing)}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    panel: {
      alignSelf: 'stretch',
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.background,
      alignItems: 'center',
      gap: SPACING.xs,
      ...SHADOWS.medium,
    },
    elapsed: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    hint: {
      ...TYPOGRAPHY.caption,
      textAlign: 'center',
      color: colors.textLight,
    },
    hintWarning: {
      color: colors.error,
      fontWeight: '600',
    },
  });
