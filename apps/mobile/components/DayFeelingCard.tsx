import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DayReviewSummary } from '@habits-coach/shared';
import { AxisIcon } from './AxisIcon';
import { TREND_AXES, formatChipLabel, formatDayTitle } from '../utils/dayTrend';
import { SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

/** Every axis is rated 1–5, so a row is five pips. */
const PIPS = [1, 2, 3, 4, 5];

interface DayFeelingCardProps {
  review: DayReviewSummary;
  today: string;
  onPress: (date: string) => void;
}

/**
 * One reviewed day: its four axes as rows of pips, and the coach's overall
 * verdict beside the date.
 *
 * `overall` is the coach's gut call at the end of a review, not a mean of the
 * axes — a review that stopped before it renders no number rather than an
 * average nobody said.
 */
export function DayFeelingCard({ review, today, onPress }: DayFeelingCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(review.reviewDate)}
      accessibilityRole="button"
      accessibilityLabel={`${formatDayTitle(review.reviewDate, today)}, ${
        review.overall ? `overall ${review.overall}` : 'reviewed'
      }`}
    >
      <View style={styles.head}>
        <Text style={styles.date}>{formatChipLabel(review.reviewDate)}</Text>
        {review.overall ? <Text style={styles.overall}>{review.overall}</Text> : null}
      </View>

      {TREND_AXES.map((axis) => (
        <View key={axis} style={styles.axisRow}>
          <AxisIcon axis={axis} size={14} color={colors.textSecondary} />
          <View style={styles.pips}>
            {PIPS.map((pip) => (
              <View
                key={pip}
                style={[
                  styles.pip,
                  { backgroundColor: pip <= (review[axis] ?? 0) ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
        </View>
      ))}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      width: 110,
      height: 125,
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      justifyContent: 'space-between',
    },
    cardPressed: {
      opacity: 0.7,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    date: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textLight,
    },
    overall: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    axisRow: {
      height: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs + 2,
    },
    pips: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    pip: {
      flex: 1,
      height: 5,
      borderRadius: 2.5,
    },
  });
