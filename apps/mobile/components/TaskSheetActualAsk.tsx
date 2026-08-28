import { Pressable, StyleSheet, View } from 'react-native';
import { DurationStepper } from './DurationStepper';
import { BodyMedium, Caption } from './ui';
import {
  formatDurationMinutes,
  getEstimateDelta,
  getEstimateDeltaColor,
} from '../utils/todoEstimate';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

/** Matches the row's Done button, which asks the same question. */
const DONE_HEIGHT = 36;

interface TaskSheetActualAskProps {
  estimateMinutes: number;
  minutes: number;
  onChange: (minutes: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Completing a task that carries an estimate asks how long it really took,
 * the same question the row asks — the sheet's date line becomes it.
 */
export function TaskSheetActualAsk({
  estimateMinutes,
  minutes,
  onChange,
  onCancel,
  onConfirm,
}: TaskSheetActualAskProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const delta = getEstimateDelta(estimateMinutes, minutes);

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Caption color={colors.textSecondary}>How long did it take?</Caption>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel completing task" hitSlop={8}>
          <Caption color={colors.textLight}>Cancel</Caption>
        </Pressable>
      </View>

      <View style={styles.controls}>
        {/* The stepper takes the slack; Done keeps its own width beside it. */}
        <View style={styles.stepper}>
          <DurationStepper minutes={minutes} onChange={onChange} />
        </View>

        <Pressable
          style={styles.done}
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Mark done, took ${formatDurationMinutes(minutes)}`}
        >
          <BodyMedium color={colors.white} style={styles.doneLabel}>
            Done
          </BodyMedium>
        </Pressable>
      </View>

      <Caption color={getEstimateDeltaColor(delta.tone, colors)}>
        {delta.tone === 'exact'
          ? 'Exactly your estimate'
          : `${formatDurationMinutes(Math.abs(delta.minutes))} ${delta.tone} your estimate`}
      </Caption>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    block: {
      gap: SPACING.xs,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.sm + 4,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    stepper: {
      flex: 1,
    },
    done: {
      height: DONE_HEIGHT,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneLabel: {
      fontWeight: '600',
    },
  });
