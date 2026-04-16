import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
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
} from '@habits-coach/shared';
import { HabitEditorModal } from '../../components/HabitEditorModal';
import { HabitManagerModal } from '../../components/HabitManagerModal';
import { HabitItem } from '../../components/HabitItem';
import { MiniCalendar } from '../../components/MiniCalendar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { BodyMedium, Card } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { BORDER_RADIUS, SHADOWS, SPACING, TAB_BAR, type Colors } from '../../constants/theme';
import {
  canGoToNextDay,
  canGoToPreviousDay,
  getNextDay,
  getPreviousDay,
} from '../../utils/dateUtils';
import { useThemedStyles } from '../../hooks/useColors';

const SWIPE_THRESHOLD = 25;

type TransitionDirection = 'forward' | 'backward';

export default function HabitsScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    habits,
    isLoading,
    loadHabits,
    addHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    removeHabit,
    setHabitStatus,
    getHabitsWithStatus,
    selectedDate,
    setSelectedDate,
  } = useHabitsStore();
  const { plansByDate, loadPlan, updateOutcomeForHabit } = useDailyPlansStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitEditor, setShowHabitEditor] = useState(false);
  const [showHabitManager, setShowHabitManager] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>('backward');

  const habitsWithStatus = getHabitsWithStatus();
  const activeHabitCount = useMemo(
    () => habits.filter((habit) => habit.active).length,
    [habits]
  );

  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerManagerButton}
            onPress={() => setShowHabitManager(true)}
            accessibilityRole="button"
            accessibilityLabel="Open habit manager"
          >
            <Ionicons name="book-outline" size={20} color={colors.text} />
          </Pressable>
          <ProfileHeaderButton />
        </View>
      ),
    });
  }, [colors.text, navigation, styles]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadHabits();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHabits]);

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
        .enabled(!showHabitEditor && !showHabitManager)
        .onEnd((event) => {
          if (event.translationX > SWIPE_THRESHOLD) {
            runOnJS(navigateToPreviousDay)();
          } else if (event.translationX < -SWIPE_THRESHOLD) {
            runOnJS(navigateToNextDay)();
          }
        }),
    [navigateToNextDay, navigateToPreviousDay, showHabitEditor, showHabitManager]
  );
  const renderHabitRow = useCallback(
    ({ item }: { item: typeof habitsWithStatus[number] }) => (
      <HabitItem
        habit={item}
        onStatusChange={handleStatusChange}
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
          onClose={closeHabitEditor}
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
    marginTop: SPACING.md,
  },
  footer: {
    height: TAB_BAR.height + SPACING.xxl,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerManagerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: SPACING.sm,
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
