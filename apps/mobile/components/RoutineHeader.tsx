import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HabitSection } from '@habits-coach/shared';
import {
  BORDER_RADIUS,
  FONT_SIZES,
  ROUTINE_ALARM_CHIP,
  SPACING,
  TOUCH_TARGET,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import RoutineAlarms from '../modules/routine-alarms';
import { getRoutineAlarmLabel } from '../utils/routineAlarmLabel';

/** Grows the 28pt chip out to the 44pt iOS minimum without moving the header. */
const CHIP_HIT_SLOP = {
  top: (TOUCH_TARGET.min - ROUTINE_ALARM_CHIP.height) / 2,
  bottom: (TOUCH_TARGET.min - ROUTINE_ALARM_CHIP.height) / 2,
  left: SPACING.sm,
  right: SPACING.md,
};

interface RoutineHeaderProps {
  title: string;
  /** Absent for the trailing "No routine" bucket: nothing to open, no alarm. */
  section?: HabitSection;
  onPress: (sectionId: string) => void;
}

/** A routine's list header, and the way into its sheet. */
export function RoutineHeader({ title, section, onPress }: RoutineHeaderProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  // Below iOS 26 there is no AlarmKit, so no chip and no alarm to offer.
  const label =
    section && RoutineAlarms.isAvailable ? getRoutineAlarmLabel(section, new Date()) : undefined;

  if (!section) return <Text style={[styles.row, styles.title]}>{title}</Text>;

  // The title opens the sheet as well as the chip: the sheet also renames a
  // routine, and on a device without AlarmKit the chip is not there to do it.
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onPress(section.id)}
        style={styles.titleTarget}
        accessibilityRole="button"
        accessibilityLabel={`${section.name}. Edit the routine`}
      >
        <Text style={styles.title}>{title}</Text>
      </Pressable>

      {label ? (
        <Pressable
          style={[styles.chip, label.active && styles.chipActive]}
          onPress={() => onPress(section.id)}
          hitSlop={CHIP_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${section.name} alarm: ${label.text}. Edit the routine`}
        >
          <Ionicons
            name={label.active ? 'alarm' : 'alarm-outline'}
            size={13}
            color={label.active ? colors.primaryDark : colors.textLight}
          />
          <Text style={[styles.chipText, label.active && styles.chipTextActive]}>
            {label.text}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    titleTarget: {
      flexShrink: 1,
      paddingVertical: SPACING.xs,
    },
    title: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      flexShrink: 1,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      height: ROUTINE_ALARM_CHIP.height,
      paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    chipActive: {
      backgroundColor: ROUTINE_ALARM_CHIP.fill,
    },
    chipText: {
      fontSize: FONT_SIZES.footnote,
      fontWeight: '600',
      color: colors.textLight,
    },
    chipTextActive: {
      color: colors.primaryDark,
    },
  });
