import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DayReviewDetail } from '@habits-coach/shared';
import { getDayReview } from '../../services/dayReviews';
import { useJournalStore } from '../../stores/useJournalStore';
import { JournalEntryCard } from '../../components/JournalEntryCard';
import { DayAxisRows } from '../../components/DayAxisRows';
import { formatDayTitle } from '../../utils/dayTrend';
import { formatVerdict } from '../../utils/coachSessions';
import { getTodayDate } from '@habits-coach/shared';
import {
  BORDER_RADIUS,
  FONT_SIZES,
  SPACING,
  TOUCH_TARGET,
  TYPOGRAPHY,
  type Colors,
} from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

// The date, not the weekday: a day reviewed days later would otherwise read
// `Monday, Aug 24 … Reviewed Wed`, with nothing saying which Wednesday.
function formatReviewedAt(review: DayReviewDetail): string {
  const at = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(review.reviewedAt));
  return `Reviewed ${at}`;
}

/**
 * One day, whole: the verdict, the four axes, the prose, that day's entries.
 *
 * The single action opens the day's own review session. Streaks key on
 * `review_date`, so filling a skipped night in over coffee repairs the streak —
 * the record is the point.
 */
export default function DayDetailScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { entries, loadEntries } = useJournalStore();

  const [review, setReview] = useState<DayReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getDayReview(date)
      .then((found) => {
        if (!cancelled) setReview(found);
      })
      .catch((error) => {
        console.warn('Failed to load day review:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const dayEntries = entries.filter((entry) => entry.entryDate === date);

  const handleReview = useCallback(() => {
    router.push({ pathname: '/session', params: { ritual: 'review-day', date } });
  }, [date, router]);

  const verdict = formatVerdict(review?.overall);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>{formatDayTitle(date, getTodayDate())}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.verdictRow}>
            <View>
              <Text style={styles.sectionLabel}>OVERALL</Text>
              <View style={styles.verdictGroup}>
                <Text style={styles.verdictNumber}>{review?.overall ?? '—'}</Text>
                {verdict ? <Text style={styles.verdictWord}>{verdict}</Text> : null}
              </View>
            </View>
            {review ? (
              <Text style={styles.reviewedAt}>
                {formatReviewedAt(review)}
                {'\n'}
                {review.depth}
              </Text>
            ) : null}
          </View>

          {review ? <DayAxisRows review={review} /> : null}

          {review?.highlight ? (
            <View style={styles.prose}>
              <Text style={styles.sectionLabel}>HIGHLIGHT</Text>
              <Text style={styles.proseText}>{review.highlight}</Text>
            </View>
          ) : null}

          {review?.friction ? (
            <View style={styles.prose}>
              <Text style={styles.sectionLabel}>FRICTION</Text>
              <Text style={styles.proseText}>{review.friction}</Text>
            </View>
          ) : null}

          <View style={styles.entries}>
            <Text style={styles.sectionLabel}>ENTRIES · {dayEntries.length}</Text>
            {dayEntries.length === 0 ? (
              <Text style={styles.reviewedAt}>Nothing written that day.</Text>
            ) : (
              dayEntries.map((entry) => <JournalEntryCard key={entry.id} entry={entry} />)
            )}
          </View>

          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={handleReview}
            accessibilityRole="button"
            accessibilityLabel={review ? 'Add to this review' : 'Review this day'}
          >
            <Feather name="moon" size={18} color={colors.primaryDark} />
            <Text style={styles.actionLabel}>
              {review ? 'Add to this review' : 'Review this day'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    back: {
      position: 'absolute',
      left: 10,
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: FONT_SIZES.body,
      fontWeight: '600',
      color: colors.textStrong,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: SPACING.md,
      gap: SPACING.md,
      paddingBottom: SPACING.xxl,
    },
    verdictRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    sectionLabel: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    verdictGroup: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: SPACING.sm,
    },
    verdictNumber: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '700',
      lineHeight: 40,
      color: colors.text,
    },
    verdictWord: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
    },
    reviewedAt: {
      fontSize: FONT_SIZES.xs,
      color: colors.textLight,
      textAlign: 'right',
    },
    prose: {
      gap: SPACING.xs,
    },
    proseText: {
      ...TYPOGRAPHY.bodyMedium,
      lineHeight: 24,
      color: colors.text,
    },
    entries: {
      gap: SPACING.sm + 2,
    },
    action: {
      height: TOUCH_TARGET.min,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionPressed: {
      opacity: 0.7,
    },
    actionLabel: {
      ...TYPOGRAPHY.label,
      fontSize: FONT_SIZES.md,
      color: colors.primaryDark,
    },
  });
