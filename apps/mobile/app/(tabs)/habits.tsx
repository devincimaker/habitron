/* eslint-disable max-lines -- HAB-89: split pending */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
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
  Habit,
  HabitDraft,
  HabitStatus,
  HabitWithStatus,
} from '@habits-coach/shared';
import { HabitEditorModal } from '../../components/HabitEditorModal';
import { HabitLogSheet } from '../../components/HabitLogSheet';
import { HabitManagerModal } from '../../components/HabitManagerModal';
import { HabitItem } from '../../components/HabitItem';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { MiniCalendar } from '../../components/MiniCalendar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { BodyMedium, Card } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
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

const SWIPE_THRESHOLD = 25;

type TransitionDirection = 'forward' | 'backward';

interface HabitSectionData {
  key: string;
  title: string | null;
  data: HabitWithStatus[];
}

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
    addSection,
    removeSection,
    setHabitStatus,
    setHabitAmount,
    getHabitsWithStatus,
    selectedDate,
    setSelectedDate,
  } = useHabitsStore();
  const { plansByDate, loadPlan, updateOutcomeForHabit } = useDailyPlansStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitEditor, setShowHabitEditor] = useState(false);
  const [showHabitManager, setShowHabitManager] = useState(false);
  const [loggingHabitId, setLoggingHabitId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>('backward');

  const habitsWithStatus = getHabitsWithStatus();
  const activeHabitCount = useMemo(
    () => habits.filter((habit) => habit.active).length,
    [habits]
  );
  const loggingHabit = useMemo(
    () => habitsWithStatus.find((habit) => habit.id === loggingHabitId) ?? null,
    [habitsWithStatus, loggingHabitId]
  );

  const listSections = useMemo<HabitSectionData[]>(() => {
    const bySection = new Map<string | undefined, HabitWithStatus[]>();
    for (const habit of habitsWithStatus) {
      const bucket = bySection.get(habit.sectionId) ?? [];
      bucket.push(habit);
      bySection.set(habit.sectionId, bucket);
    }

    const result: HabitSectionData[] = [];
    for (const section of sections) {
      const data = bySection.get(section.id);
      if (data?.length) {
        result.push({ key: section.id, title: section.name, data });
      }
    }
    const unsorted = habitsWithStatus.filter(
      (habit) => !habit.sectionId || !sections.some((section) => section.id === habit.sectionId)
    );
    if (unsorted.length) {
      result.push({ key: 'unsorted', title: null, data: unsorted });
    }
    return result;
  }, [habitsWithStatus, sections]);

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
      const needsSheet =
        habit.autoPopupLog ||
        (habit.goalType === 'quantity' && habit.checkInMode === 'manual');
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
      } else {
        await addHabit(draft);
      }
    },
    [addHabit, editingHabit, updateHabit]
  );

  const closeHabitEditor = useCallback(() => {
    setShowHabitEditor(false);
    setEditingHabit(null);
  }, []);

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
        .enabled(!showHabitEditor && !showHabitManager && !loggingHabitId)
        .onEnd((event) => {
          if (event.translationX > SWIPE_THRESHOLD) {
            runOnJS(navigateToPreviousDay)();
          } else if (event.translationX < -SWIPE_THRESHOLD) {
            runOnJS(navigateToNextDay)();
          }
        }),
    [loggingHabitId, navigateToNextDay, navigateToPreviousDay, showHabitEditor, showHabitManager]
  );
  const renderHabitRow = useCallback(
    ({ item }: { item: HabitWithStatus }) => (
      <HabitItem
        habit={item}
        onStatusChange={handleStatusChange}
        onCheckIn={handleCheckIn}
        onPress={(habitId) => {
          const selected = habits.find((candidate) => candidate.id === habitId);
          if (selected) {
            openHabitEditor(selected);
          }
        }}
      />
    ),
    [habits, handleCheckIn, handleStatusChange, openHabitEditor]
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: HabitSectionData }) =>
      section.title ? (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      ) : null,
    [styles]
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
            <SectionList
              sections={listSections}
              renderItem={renderHabitRow}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={(habit) => habit.id}
              ListEmptyComponent={isLoading ? null : renderEmptyState}
              contentContainerStyle={styles.listContent}
              contentInsetAdjustmentBehavior="automatic"
              stickySectionHeadersEnabled={false}
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
  footer: {
    height: TAB_BAR.height + SPACING.xxl,
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
