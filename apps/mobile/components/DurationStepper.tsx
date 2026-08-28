import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { decrementDuration, formatDurationMinutes, incrementDuration } from '../utils/todoEstimate';
import { BORDER_RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

/** The row's completion ask sets the inline size; the dialog gets a full target. */
const INLINE_BUTTON = 36;

interface DurationStepperProps {
  minutes: number;
  onChange: (minutes: number) => void;
  /** `large` is the estimate dialog's headline; `inline` sits in a row. */
  size?: 'inline' | 'large';
}

/**
 * Minus, a duration, plus. Shared by the estimate dialog and the task sheet's
 * completion ask so the step scale is only ever asked for one way.
 */
export function DurationStepper({ minutes, onChange, size = 'inline' }: DurationStepperProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const isLarge = size === 'large';

  return (
    <View style={[styles.row, isLarge && styles.rowLarge]}>
      <Pressable
        style={[styles.button, isLarge && styles.buttonLarge]}
        onPress={() => onChange(decrementDuration(minutes))}
        accessibilityRole="button"
        accessibilityLabel="Less time"
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>

      <Text style={[styles.value, isLarge && styles.valueLarge]}>
        {formatDurationMinutes(minutes)}
      </Text>

      <Pressable
        style={[styles.button, isLarge && styles.buttonLarge]}
        onPress={() => onChange(incrementDuration(minutes))}
        accessibilityRole="button"
        accessibilityLabel="More time"
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    rowLarge: {
      justifyContent: 'center',
      gap: SPACING.lg,
      paddingTop: SPACING.sm,
    },
    button: {
      width: INLINE_BUTTON,
      height: INLINE_BUTTON,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLarge: {
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
    },
    value: {
      flex: 1,
      textAlign: 'center',
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    valueLarge: {
      flex: 0,
      minWidth: 96,
      ...TYPOGRAPHY.displayLarge,
      color: colors.text,
    },
  });
