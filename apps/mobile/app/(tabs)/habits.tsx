import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  runOnJS,
} from 'react-native-reanimated';
import type {
  Goal,
  Habit,
  HabitDraft,
  HabitStatus,
} from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { IconPicker } from '../../components/IconPicker';
import { HabitEditorModal } from '../../components/HabitEditorModal';
import { HabitItem } from '../../components/HabitItem';
import { MiniCalendar } from '../../components/MiniCalendar';
import { SectionHeader } from '../../components/SectionHeader';
import { BodyMedium, Card } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { SPACING, type Colors } from '../../constants/theme';
import {
  canGoToNextDay,
  canGoToPreviousDay,
  formatShortDate,
  getNextDay,
  getPreviousDay,
} from '../../utils/dateUtils';
import { useThemedStyles, useColors } from '../../hooks/useColors';

const SWIPE_THRESHOLD = 25;

type TransitionDirection = 'forward' | 'backward';

export default function HabitsScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const today = getTodayDate();
  const {
    habits,
    isLoading,
    loadHabits,
    addHabit,
    updateHabit,
    setHabitStatus,
    getHabitsWithStatus,
    selectedDate,
    setSelectedDate,
  } = useHabitsStore();
  const { goals, loadGoals } = useGoalsStore();
  const { plansByDate, loadPlan, updateOutcomeForHabit } = useDailyPlansStore();

  const [iconPickerHabitId, setIconPickerHabitId] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitEditor, setShowHabitEditor] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>('backward');

  const habitsWithStatus = getHabitsWithStatus();
  const completedCount = useMemo(
    () => habitsWithStatus.filter((habit) => habit.todayStatus === 'completed').length,
    [habitsWithStatus]
  );
  const habitsSubtitle = useMemo(() => {
    if (habitsWithStatus.length === 0) {
      return selectedDate === today
        ? 'No habits yet'
        : `No habits for ${formatShortDate(selectedDate)}`;
    }

    const progressLabel = `${completedCount}/${habitsWithStatus.length} completed`;
    return selectedDate === today
      ? progressLabel
      : `${progressLabel} · ${formatShortDate(selectedDate)}`;
  }, [completedCount, habitsWithStatus.length, selectedDate, today]);

  useEffect(() => {
    void Promise.all([loadHabits(), loadGoals()]);
  }, [loadGoals, loadHabits]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadHabits(), loadGoals()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadGoals, loadHabits]);

  const handleStatusChange = useCallback(
    async (habitId: string, status: HabitStatus) => {
      await setHabitStatus(habitId, status);

      const planForDate =
        plansByDate[selectedDate] === undefined
          ? await loadPlan(selectedDate)
          : plansByDate[selectedDate];

      if (planForDate) {
        await updateOutcomeForHabit(
          selectedDate,
          habitId,
          status === 'completed' ? 'completed_as_planned' : 'not_done'
        );
      }
    },
    [loadPlan, plansByDate, selectedDate, setHabitStatus, updateOutcomeForHabit]
  );

  const handleSelectIcon = useCallback(
    async (icon: string) => {
      if (!iconPickerHabitId) return;
      await updateHabit(iconPickerHabitId, { icon });
      setIconPickerHabitId(null);
    },
    [iconPickerHabitId, updateHabit]
  );

  const handleSaveHabit = useCallback(
    async (draft: HabitDraft) => {
      if (editingHabit) {
        await updateHabit(editingHabit.id, draft);
      } else {
        await addHabit(draft);
      }
    },
    [addHabit, editingHabit, updateHabit]
  );

  const openHabitEditor = useCallback((habit?: Habit | null) => {
    setEditingHabit(habit ?? null);
    setShowHabitEditor(true);
  }, []);
  const handleSelectDate = useCallback(
    (nextDate: string) => {
      if (nextDate === selectedDate) {
        return;
      }

      setTransitionDirection(nextDate > selectedDate ? 'forward' : 'backward');
      void setSelectedDate(nextDate);
    },
    [selectedDate, setSelectedDate]
  );

  const navigateToPreviousDay = useCallback(() => {
    if (canGoToPreviousDay(selectedDate)) {
      handleSelectDate(getPreviousDay(selectedDate));
    }
  }, [handleSelectDate, selectedDate]);

  const navigateToNextDay = useCallback(() => {
    if (canGoToNextDay(selectedDate)) {
      handleSelectDate(getNextDay(selectedDate));
    }
  }, [handleSelectDate, selectedDate]);

  const daySwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
        .failOffsetY([-12, 12])
        .enabled(!showHabitEditor && iconPickerHabitId === null)
        .onEnd((event) => {
          if (event.translationX > SWIPE_THRESHOLD) {
            runOnJS(navigateToPreviousDay)();
          } else if (event.translationX < -SWIPE_THRESHOLD) {
            runOnJS(navigateToNextDay)();
          }
        }),
    [iconPickerHabitId, navigateToNextDay, navigateToPreviousDay, showHabitEditor]
  );
  const renderHabitRow = useCallback(
    ({ item }: { item: typeof habitsWithStatus[number] }) => (
      <HabitItem
        habit={item}
        onStatusChange={handleStatusChange}
        onLongPress={setIconPickerHabitId}
        onPress={(habitId) => {
          const selected = habits.find((candidate) => candidate.id === habitId);
          if (selected) {
            openHabitEditor(selected);
          }
        }}
      />
    ),
    [habits, handleStatusChange, openHabitEditor]
  );
  const listEntering =
    transitionDirection === 'forward'
      ? FadeInRight.duration(220).easing(Easing.out(Easing.cubic))
      : FadeInLeft.duration(220).easing(Easing.out(Easing.cubic));
  const listExiting =
    transitionDirection === 'forward'
      ? FadeOutLeft.duration(150).easing(Easing.in(Easing.cubic))
      : FadeOutRight.duration(150).easing(Easing.in(Easing.cubic));
  const renderEmptyState = useCallback(
    () => (
      <Card variant="surface" style={styles.emptyCard}>
        <BodyMedium>
          You do not have any habits yet. Add one here or let Habitron suggest one in a
          session.
        </BodyMedium>
      </Card>
    ),
    [styles]
  );

  const selectedHabit = iconPickerHabitId
    ? habitsWithStatus.find((habit) => habit.id === iconPickerHabitId)
    : null;

  return (
    <GestureDetector gesture={daySwipeGesture}>
      <View style={styles.container}>
        <MiniCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />
        <SectionHeader
          title="Habits"
          subtitle={habitsSubtitle}
          actionLabel="Add"
          onPressAction={() => openHabitEditor()}
        />

        <View style={styles.listContainer}>
          <Animated.View
            key={selectedDate}
            style={styles.listBody}
            entering={listEntering}
            exiting={listExiting}
          >
            <FlatList
              data={habitsWithStatus}
              renderItem={renderHabitRow}
              keyExtractor={(habit) => habit.id}
              ListEmptyComponent={isLoading ? null : renderEmptyState}
              contentContainerStyle={styles.listContent}
              contentInsetAdjustmentBehavior="automatic"
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => void handleRefresh()}
                  tintColor={colors.primary}
                />
              }
              ListFooterComponent={<View style={styles.footer} />}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        </View>

        <IconPicker
          visible={iconPickerHabitId !== null}
          selectedIcon={selectedHabit?.icon}
          onSelectIcon={handleSelectIcon}
          onClose={() => setIconPickerHabitId(null)}
        />

        <HabitEditorModal
          visible={showHabitEditor}
          habit={editingHabit}
          goals={goals as Goal[]}
          onClose={() => {
            setShowHabitEditor(false);
            setEditingHabit(null);
          }}
          onSave={handleSaveHabit}
        />
      </View>
    </GestureDetector>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  listBody: {
    ...StyleSheet.absoluteFillObject,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  emptyCard: {
    marginHorizontal: SPACING.md,
  },
  footer: {
    height: SPACING.xxl,
  },
});
