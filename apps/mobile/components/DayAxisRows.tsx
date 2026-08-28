import { View, Text, StyleSheet } from 'react-native';
import type { DayReviewSummary } from '@habits-coach/shared';
import { rampColor } from '../constants/dayTrend';
import { AXIS_LABELS, TREND_AXES } from '../utils/dayTrend';
import { BORDER_RADIUS, FONT_SIZES, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const VALUES = [1, 2, 3, 4, 5];

interface DayAxisRowsProps {
  review: DayReviewSummary;
}

/** The four axes as they were rated, read-only — this screen is the record. */
export function DayAxisRows({ review }: DayAxisRowsProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      {TREND_AXES.map((axis) => {
        const value = review[axis];
        const fill = rampColor(colors.primary, value);

        return (
          <View
            key={axis}
            style={styles.row}
            accessible
            // The dots are unlabelled Views, so without this the row reads as
            // its axis and nothing else.
            accessibilityLabel={`${AXIS_LABELS[axis]}, ${value ? `${value} of 5` : 'not rated'}`}
          >
            <Text style={styles.label} numberOfLines={1}>
              {AXIS_LABELS[axis]}
            </Text>
            <View style={styles.dots}>
              {VALUES.map((v) => {
                const filled = value !== undefined && v <= value;
                return (
                  <View
                    key={v}
                    style={[
                      styles.dot,
                      filled && fill
                        ? { backgroundColor: fill, borderColor: colors.primary }
                        : styles.dotEmpty,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 36,
      gap: SPACING.sm + 4,
    },
    label: {
      // At an accessibility text size the label is what gives way, not the
      // dots — they are the only thing on the row that carries the rating.
      flexShrink: 1,
      fontSize: FONT_SIZES.sm + 1,
      color: colors.text,
    },
    dots: {
      // One right edge for all four rows, whatever the labels measure.
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1,
      flexShrink: 0,
    },
    dotEmpty: {
      backgroundColor: 'transparent',
      borderColor: colors.hairline,
    },
  });
