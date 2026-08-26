import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { rampColor } from '../constants/dayTrend';
import { TREND_AXES, type DayGroup } from '../utils/dayTrend';
import { FONT_SIZES, SPACING, TOUCH_TARGET, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface DaySummaryRowProps {
  group: DayGroup;
  onPress: (date: string) => void;
}

/**
 * The header of a day in the list, and the way into its detail.
 *
 * The list groups by day rather than by entry, so this is a row even when the
 * day holds only a review — a reviewed day with nothing written is still a day
 * that happened, and it says `No entries` rather than disappearing.
 */
export function DaySummaryRow({ group, onPress }: DaySummaryRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const { review, entries } = group;

  const entryCount = entries.length
    ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
    : 'No entries';

  // A review can stop before the overall rating — reviewed without a verdict is
  // still reviewed, and saying otherwise contradicts the strip counting it.
  const reviewState = review
    ? review.overall
      ? `overall ${review.overall}`
      : 'reviewed'
    : 'not reviewed';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(group.date)}
      accessibilityRole="button"
      accessibilityLabel={`${group.title}, ${reviewState}, ${entryCount}`}
    >
      <View style={styles.titleGroup}>
        <Text style={styles.title}>{group.title}</Text>
        <Text style={styles.subtitle}>{entryCount}</Text>
      </View>

      <View style={styles.meta}>
        {review?.overall ? <Text style={styles.verdict}>{review.overall}</Text> : null}
        {review ? (
          <View style={styles.dots}>
            {TREND_AXES.map((axis) => {
              const color = rampColor(colors.primary, review[axis]);
              return (
                <View
                  key={axis}
                  style={[styles.dot, color ? { backgroundColor: color } : styles.dotEmpty]}
                />
              );
            })}
          </View>
        ) : null}
        <Feather name="chevron-right" size={18} color={colors.textLight} />
      </View>
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
    titleGroup: {
      flexShrink: 1,
    },
    title: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      lineHeight: 26,
      color: colors.text,
    },
    subtitle: {
      fontSize: FONT_SIZES.xs,
      lineHeight: 16,
      color: colors.textLight,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    verdict: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotEmpty: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
