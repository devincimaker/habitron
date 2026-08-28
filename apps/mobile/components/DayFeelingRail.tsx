import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { DayReviewSummary } from '@habits-coach/shared';
import { AxisIcon } from './AxisIcon';
import { DayFeelingCard } from './DayFeelingCard';
import { Label } from './ui';
import { AXIS_LABELS, TREND_AXES } from '../utils/dayTrend';
import { SPACING, TOUCH_TARGET, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { usePersistedFlag } from '../hooks/usePersistedFlag';

/** Collapsing the rail is a preference, so it outlives the visit. */
const COLLAPSED_KEY = 'journal.feelingRail.collapsed';

interface DayFeelingRailProps {
  reviews: DayReviewSummary[];
  today: string;
  onOpenDay: (date: string) => void;
}

/**
 * The last month of reviewed days, newest first.
 *
 * Nothing is drawn for a day with no review: an unreviewed day is not a gap to
 * fill in — a day is reviewed on the day or not at all — so the rail holds only
 * days that happened, and the whole section is absent until one has.
 */
export const DayFeelingRail = memo(function DayFeelingRail({
  reviews,
  today,
  onOpenDay,
}: DayFeelingRailProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const { value: isCollapsed, isReady, toggle } = usePersistedFlag(COLLAPSED_KEY);

  // Nothing until storage has answered, so a rail the user collapsed does not
  // appear for a frame and snap shut.
  if (reviews.length === 0 || !isReady) return null;

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.header}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        accessibilityLabel="How you've been"
      >
        <Label color={colors.textSecondary}>How you&apos;ve been</Label>
        <Feather
          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {isCollapsed ? null : (
        <>
          <View style={styles.key}>
            {TREND_AXES.map((axis) => (
              <View key={axis} style={styles.keyItem}>
                <AxisIcon axis={axis} size={11} color={colors.textLight} />
                <Text style={styles.keyLabel}>{AXIS_LABELS[axis]}</Text>
              </View>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {reviews.map((review) => (
              <DayFeelingCard
                key={review.reviewDate}
                review={review}
                today={today}
                onPress={onOpenDay}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    section: {
      gap: SPACING.sm,
    },
    header: {
      height: TOUCH_TARGET.min,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.xs,
    },
    key: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: SPACING.xs,
    },
    keyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    keyLabel: {
      fontSize: 11,
      color: colors.textLight,
    },
    rail: {
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xs,
      // Bleeds to the screen edge, so a card half in view says "keep scrolling".
      paddingRight: SPACING.xl,
    },
  });
