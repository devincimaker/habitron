/* eslint-disable max-lines -- HAB-89: split pending */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  DesiredHabit,
  Habit,
  HabitDraft,
  HabitStatus,
  HabitWithStatus,
} from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { DesiredHabitsSection } from '../../components/DesiredHabitsSection';
import { HabitEditorModal } from '../../components/HabitEditorModal';
import { HabitLogSheet } from '../../components/HabitLogSheet';
import { HabitManagerModal } from '../../components/HabitManagerModal';
import {
  HabitSectionList,
  type HabitSectionListHandle,
} from '../../components/HabitSectionList';
import { RoutineSheet } from '../../components/RoutineSheet';

import { HeaderIconButton } from '../../components/HeaderIconButton';
import { MiniCalendar } from '../../components/MiniCalendar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { BodyMedium, Card } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useDesiredHabitsStore } from '../../stores/useDesiredHabitsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { getRoutineProgress } from '../../utils/routineProgress';
import {
  HEADER,
  SHADOWS,
  SPACING,
  TAB_BAR,
  TYPOGRAPHY,
  type Colors,
} from '../../constants/theme';
import {
  canGoToNextDay,
  canGoToPreviousDay,
  getNextDay,
  getPreviousDay,
} from '../../utils/dateUtils';
import { getCheckInIncrement } from '../../utils/habitSchedule';
import { useThemedStyles } from '../../hooks/useColors';

/** How long the routine takeover's habit stays outlined after landing. */
const UP_NOW_MS = 3000;

const SWIPE_THRESHOLD = 25;

type TransitionDirection = 'forward' | 'backward';

export default function HabitsScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    habits,
    sections,
    isLoading,
    loadHabits,
    addHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    removeHabit,
    reorderHabits,
    addSection,
    removeSection,
    updateSection,
    setHabitStatus,
    setHabitAmount,
    getHabitsWithStatus,
    selectedDate,
    setSelectedDate,
  } = useHabitsStore();
  const { plansByDate, loadPlan, updateOutcomeForHabit } = useDailyPlansStore();
  const linkDesiredHabit = useDesiredHabitsStore((state) => state.updateDesiredHabit);

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitEditor, setShowHabitEditor] = useState(false);
  const [showHabitManager, setShowHabitManager] = useState(false);
  const [loggingHabitId, setLoggingHabitId] = useState<string | null>(null);
  /** The desired habit whose "Start this habit" opened the editor, if any. */
  const [startingDesired, setStartingDesired] = useState<DesiredHabit | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** The routine whose sheet is open, by id. */
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>('backward');

  /** Set by the routine takeover when it hands over: scroll here, outline this. */
  const { routine: landedRoutineId } = useLocalSearchParams<{ routine?: string }>();
  const listRef = useRef<HabitSectionListHandle>(null);
  const [upNowHabitId, setUpNowHabitId] = useState<string | undefined>();

  // Landing from the routine takeover: scroll the routine into view and mark
  // the habit it left off on, then let it fade back into an ordinary row.
  //
  // `routine` is a route param, so it survives every later render — it is a
  // one-shot command living in persistent state. Clearing it once the handover
  // is done is what stops the outline reappearing on every check-in, and the
  // store is read here rather than closed over so the effect needs no other
  // dependency to be correct.
  //
  // The timer lives in a ref rather than in the effect's cleanup: clearing the
  // param re-runs this effect immediately, and a cleanup would cancel the fade
  // it had just armed, leaving the row outlined for good.
  const upNowTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(upNowTimer.current), []);

  useEffect(() => {
    if (!landedRoutineId || isLoading) return;

    const { habits: current, dateLogs: logs } = useHabitsStore.getState();
    const progress = getRoutineProgress(
      landedRoutineId,
      current,
      logs.get(getTodayDate()) ?? new Map(),
      getTodayDate()
    );
    const upNow = progress.current ?? progress.due[progress.due.length - 1];

    listRef.current?.scrollToSection(landedRoutineId);
    setUpNowHabitId(upNow?.id);
    router.setParams({ routine: undefined });

    clearTimeout(upNowTimer.current);
    upNowTimer.current = setTimeout(() => setUpNowHabitId(undefined), UP_NOW_MS);
  }, [isLoading, landedRoutineId]);

  const editingRoutine = useMemo(
    () => sections.find((section) => section.id === editingRoutineId) ?? null,
    [editingRoutineId, sections]
  );
  /** Lowercased, so the sheet's rename check is case-insensitive like the DB's. */
  const takenRoutineNames = useMemo(
    () =>
      sections
        .filter((section) => section.id !== editingRoutineId)
        .map((section) => section.name.toLowerCase()),
    [editingRoutineId, sections]
  );

  const habitsWithStatus = getHabitsWithStatus();
  const activeHabitCount = useMemo(
    () => habits.filter((habit) => habit.active).length,
    [habits]
  );
  const loggingHabit = useMemo(
    () => habitsWithStatus.find((habit) => habit.id === loggingHabitId) ?? null,
    [habitsWithStatus, loggingHabitId]
  );


  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <HeaderIconButton
            name="book-outline"
            accessibilityLabel="Open habit manager"
            onPress={() => setShowHabitManager(true)}
          />
          <ProfileHeaderButton />
        </View>
      ),
    });
  }, [navigation, styles]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadHabits();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHabits]);

  const syncPlanOutcome = useCallback(
    async (habitId: string, status: HabitStatus) => {
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
    [loadPlan, plansByDate, selectedDate, updateOutcomeForHabit]
  );

  const handleStatusChange = useCallback(
    async (habitId: string, status: HabitStatus) => {
      await setHabitStatus(habitId, status);
      await syncPlanOutcome(habitId, status);
    },
    [setHabitStatus, syncPlanOutcome]
  );

  const handleAmountChange = useCallback(
    async (habitId: string, amount: number) => {
      await setHabitAmount(habitId, amount);
      const updated = useHabitsStore.getState().getHabitsWithStatus().find((h) => h.id === habitId);
      await syncPlanOutcome(habitId, updated?.todayStatus ?? 'pending');
    },
    [setHabitAmount, syncPlanOutcome]
  );

  const handleCheckIn = useCallback(
    (habit: HabitWithStatus) => {
      const needsSheet = habit.goalType === 'quantity' && habit.checkInMode === 'manual';
      if (needsSheet) {
        setLoggingHabitId(habit.id);
        return;
      }

      if (habit.goalType !== 'quantity') {
        void handleStatusChange(
          habit.id,
          habit.todayStatus === 'completed' ? 'pending' : 'completed'
        );
        return;
      }

      if (habit.todayStatus === 'completed') {
        void handleStatusChange(habit.id, 'pending');
        return;
      }

      void handleAmountChange(habit.id, habit.todayAmount + getCheckInIncrement(habit));
    },
    [handleAmountChange, handleStatusChange]
  );

  const handleSaveHabit = useCallback(
    async (draft: HabitDraft) => {
      if (editingHabit) {
        await updateHabit(editingHabit.id, draft);
        return;
      }

      const created = await addHabit(draft);
      if (startingDesired) {
        await linkDesiredHabit(startingDesired.id, { habitId: created.id });
      }
    },
    [addHabit, editingHabit, linkDesiredHabit, startingDesired, updateHabit]
  );

  const closeHabitEditor = useCallback(() => {
    setShowHabitEditor(false);
    setEditingHabit(null);
    setStartingDesired(null);
  }, []);

  const handleStartDesiredHabit = useCallback((desired: DesiredHabit) => {
    setStartingDesired(desired);
    setEditingHabit(null);
    setShowHabitEditor(true);
  }, []);

  const openHabitEditor = useCallback((habit?: Habit | null) => {
    setEditingHabit(habit ?? null);
    setStartingDesired(null);
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

  const [isDragging, setIsDragging] = useState(false);
  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);
  const handlePressHabit = useCallback(
    (habitId: string) => {
      const selected = habits.find((candidate) => candidate.id === habitId);
      if (selected) openHabitEditor(selected);
    },
    [habits, openHabitEditor]
  );

  const daySwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
        .failOffsetY([-12, 12])
        .enabled(!showHabitEditor && !showHabitManager && !loggingHabitId && !isDragging)
        .onEnd((event) => {
          if (event.translationX > SWIPE_THRESHOLD) {
            runOnJS(navigateToPreviousDay)();
          } else if (event.translationX < -SWIPE_THRESHOLD) {
            runOnJS(navigateToNextDay)();
          }
        }),
    [
      isDragging,
      loggingHabitId,
      navigateToNextDay,
      navigateToPreviousDay,
      showHabitEditor,
      showHabitManager,
    ]
  );
  const handleEditFromManager = useCallback(
    (habit: Habit) => {
      setShowHabitManager(false);
      openHabitEditor(habit);
    },
    [openHabitEditor]
  );
  const handleArchiveFromManager = useCallback(
    (habit: Habit) => {
      Alert.alert(
        'Archive Habit',
        `Archive "${habit.name}"? You can restore it later from archived habits.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: async () => {
              await archiveHabit(habit.id);
            },
          },
        ]
      );
    },
    [archiveHabit]
  );
  const handleRestoreFromManager = useCallback(
    (habit: Habit) => {
      Alert.alert(
        'Restore Habit',
        `Bring "${habit.name}" back into your daily list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              await restoreHabit(habit.id);
            },
          },
        ]
      );
    },
    [restoreHabit]
  );
  const handleDeleteFromManager = useCallback(
    (habit: Habit) => {
      Alert.alert(
        'Delete Habit',
        `Permanently delete "${habit.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await removeHabit(habit.id);
            },
          },
        ]
      );
    },
    [removeHabit]
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
          {activeHabitCount === 0
            ? 'You do not have any habits yet. Add one here or let Habitron suggest one in a session.'
            : 'No habits are scheduled for this day.'}
        </BodyMedium>
      </Card>
    ),
    [activeHabitCount, styles]
  );

  return (
    <GestureDetector gesture={daySwipeGesture}>
      <View style={styles.container}>
        <MiniCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />

        <View style={styles.listContainer}>
          <Animated.View
            key={selectedDate}
            style={styles.listBody}
            entering={listEntering}
            exiting={listExiting}
          >
            <HabitSectionList
              ref={listRef}
              sections={sections}
              habits={habitsWithStatus}
              isDragging={isDragging}
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              refreshTintColor={colors.primary}
              emptyComponent={renderEmptyState()}
              onRefresh={() => void handleRefresh()}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onReorder={(updates) => void reorderHabits(updates)}
              onStatusChange={handleStatusChange}
              onCheckIn={handleCheckIn}
              onPressHabit={handlePressHabit}
              onPressRoutine={setEditingRoutineId}
              highlightHabitId={upNowHabitId}
              footer={<DesiredHabitsSection onStartHabit={handleStartDesiredHabit} />}
            />
          </Animated.View>
        </View>

        {isDragging ? null : (
          <Pressable
            style={[
              styles.fab,
              { bottom: TAB_BAR.height + insets.bottom + SPACING.lg },
            ]}
            onPress={() => openHabitEditor()}
            accessibilityRole="button"
            accessibilityLabel="Add a new habit"
          >
            <Ionicons name="add" size={28} color={colors.white} />
          </Pressable>
        )}

        <HabitManagerModal
          visible={showHabitManager}
          habits={habits}
          isLoading={isLoading}
          onClose={() => setShowHabitManager(false)}
          onEdit={handleEditFromManager}
          onArchive={handleArchiveFromManager}
          onRestore={handleRestoreFromManager}
          onDelete={handleDeleteFromManager}
        />

        <HabitEditorModal
          visible={showHabitEditor}
          habit={editingHabit}
          initialName={startingDesired?.title}
          sections={sections}
          allHabits={habits}
          onClose={closeHabitEditor}
          onSave={handleSaveHabit}
          onAddSection={addSection}
          onRemoveSection={removeSection}
        />

        <HabitLogSheet
          habit={loggingHabit}
          onClose={() => setLoggingHabitId(null)}
          onSaveAmount={handleAmountChange}
          onSetStatus={handleStatusChange}
        />

        <RoutineSheet
          visible={editingRoutine !== null}
          section={editingRoutine}
          habits={habits}
          takenNames={takenRoutineNames}
          onClose={() => setEditingRoutineId(null)}
          onSave={updateSection}
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
  sectionHeader: {
    ...TYPOGRAPHY.label,
    color: colors.textSecondary,
    paddingHorizontal: SPACING.md + SPACING.xs,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HEADER.controlGap,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
});
