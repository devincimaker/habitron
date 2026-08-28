import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTodayDate } from '@habits-coach/shared';
import {
  BORDER_RADIUS,
  COLORS_DARK,
  FONT_SIZES,
  SPACING,
  TOUCH_TARGET,
} from '../constants/theme';
import { useHabitsStore } from '../stores/useHabitsStore';
import { getDayNameForDate } from '../utils/habitSchedule';
import { getRoutineProgress } from '../utils/routineProgress';
import { formatReminderTime } from '../utils/habitTime';

/** The splash ink. The takeover is the alarm's screen, not the app's. */
const INK = '#1C1A17';
const DONE_DISC = 168;

/**
 * Where the alarm's **Start** lands: one habit at a time, with a target big
 * enough to hit half awake. Reached only by the deep link the alarm's intent
 * fires.
 */
export default function RoutineStartScreen() {
  const { section: sectionId } = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const habits = useHabitsStore((state) => state.habits);
  const sections = useHabitsStore((state) => state.sections);
  const dateLogs = useHabitsStore((state) => state.dateLogs);
  const isLoading = useHabitsStore((state) => state.isLoading);
  const setHabitStatus = useHabitsStore((state) => state.setHabitStatus);
  const setSelectedDate = useHabitsStore((state) => state.setSelectedDate);

  const today = getTodayDate();

  // Done and Skip write to the store's selected date, and nothing else moves it
  // off whatever the mini-calendar last chose. The alarm's whole point is that
  // the app has been backgrounded since yesterday, so the takeover pulls it
  // back to today before it can log anything against the wrong day.
  useEffect(() => {
    if (useHabitsStore.getState().selectedDate !== today) void setSelectedDate(today);
  }, [setSelectedDate, today]);
  const section = sections.find((candidate) => candidate.id === sectionId);

  // Resolved live rather than walked from a list captured on open: a habit
  // logged from somewhere else should not leave this screen asking about it.
  const progress = useMemo(
    () =>
      sectionId
        ? getRoutineProgress(sectionId, habits, dateLogs.get(today) ?? new Map(), today)
        : null,
    [dateLogs, habits, sectionId, today]
  );

  const openList = useCallback(() => {
    router.replace({ pathname: '/(tabs)/habits', params: { routine: sectionId ?? '' } });
  }, [router, sectionId]);

  const current = progress?.current;

  // Nothing left to ask about — or nothing due at all — so the list is the
  // right place to be, without a Done that would have nothing to log.
  //
  // `isLoading` is the guard that matters here: the alarm deep-links into a
  // cold app, where the store is still empty and every routine looks finished.
  useEffect(() => {
    if (!isLoading && progress && !current) openList();
  }, [current, isLoading, openList, progress]);

  if (isLoading || !section || !progress || !current) {
    return <View style={styles.container} />;
  }

  // The time that actually rang is today's, not the chip's "next ring".
  const rangAt = section.alarmByDay[getDayNameForDate(new Date())];
  const { upcoming } = progress;

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.sm }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.close}
          onPress={openList}
          accessibilityRole="button"
          accessibilityLabel="Leave the routine"
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>
        {rangAt ? (
          <Text style={styles.rang}>{`Rang ${formatReminderTime(rangAt)}`}</Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>{`${section.name.toUpperCase()} STARTS NOW`}</Text>
        <Text style={styles.habit}>{current.name}</Text>
        <Text style={styles.progress}>
          {`${progress.index} of ${progress.due.length}`}
          {upcoming.length > 0 ? ` · then ${upcoming.join(', ')}` : ''}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.done}
          onPress={() => void setHabitStatus(current.id, 'completed')}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${current.name} done`}
        >
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
        <Text style={styles.doneCaption}>{`Take your time. Tap when ${current.name} is done.`}</Text>

        <Pressable
          onPress={() => void setHabitStatus(current.id, 'skipped')}
          accessibilityRole="button"
          accessibilityLabel={`Skip ${current.name} today`}
          hitSlop={SPACING.sm}
        >
          <Text style={styles.secondary}>Skip today</Text>
        </Pressable>
        <Pressable
          onPress={openList}
          accessibilityRole="button"
          accessibilityLabel="Open the habit list"
          hitSlop={SPACING.sm}
        >
          <Text style={styles.secondary}>Open the list</Text>
        </Pressable>
      </View>

      <View style={{ height: insets.bottom + SPACING.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: INK,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  close: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -SPACING.sm,
  },
  rang: {
    fontSize: FONT_SIZES.footnote,
    color: 'rgba(255,255,255,0.45)',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  kicker: {
    fontSize: FONT_SIZES.footnote,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS_DARK.primary,
  },
  habit: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 60,
    color: '#FFFFFF',
  },
  progress: {
    fontSize: FONT_SIZES.body,
    color: 'rgba(255,255,255,0.55)',
  },
  actions: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  done: {
    width: DONE_DISC,
    height: DONE_DISC,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS_DARK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    fontSize: 28,
    fontWeight: '700',
    color: INK,
  },
  doneCaption: {
    fontSize: FONT_SIZES.footnote,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  secondary: {
    fontSize: FONT_SIZES.body,
    color: 'rgba(255,255,255,0.7)',
  },
});
