import { Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { DayGroup } from '../utils/dayTrend';
import { FONT_SIZES, SPACING, TOUCH_TARGET, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface DaySummaryRowProps {
  group: DayGroup;
  onPress: (date: string) => void;
}

/**
 * The header of a day in the list, and the way into its detail. How the day
 * felt is the rail's job now, so this carries the date and nothing else.
 */
export function DaySummaryRow({ group, onPress }: DaySummaryRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(group.date)}
      accessibilityRole="button"
      accessibilityLabel={`${group.title}, ${group.entries.length} ${
        group.entries.length === 1 ? 'entry' : 'entries'
      }`}
    >
      <Text style={styles.title}>{group.title}</Text>
      <Feather name="chevron-right" size={18} color={colors.textLight} />
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm + 4,
      minHeight: TOUCH_TARGET.min,
    },
    rowPressed: {
      opacity: 0.7,
    },
    title: {
      flexShrink: 1,
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      lineHeight: 26,
      color: colors.text,
    },
  });
