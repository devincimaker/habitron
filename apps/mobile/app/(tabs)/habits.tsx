import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { HabitItem } from '../../components/HabitItem';
import { IconPicker } from '../../components/IconPicker';
import { HabitDetailsModal } from '../../components/HabitDetailsModal';
import { EmptyState } from '../../components/EmptyState';
import { MiniCalendar } from '../../components/MiniCalendar';
import { HabitStatus, HabitWithStatus } from '@habits-coach/shared';
import { COLORS, SPACING } from '../../constants/theme';
import {
  canGoToPreviousDay,
  canGoToNextDay,
  getPreviousDay,
  getNextDay,
} from '../../utils/dateUtils';

const SWIPE_THRESHOLD = 50;

export default function HabitsScreen() {
  const {
    habits,
    isLoading,
    loadHabits,
    setHabitStatus,
    updateHabit,
    getHabitsWithStatus,
    selectedDate,
    setSelectedDate,
  } = useHabitsStore();

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [detailsHabitId, setDetailsHabitId] = useState<string | null>(null);

  const habitsWithStatus = getHabitsWithStatus();
  const selectedHabit = selectedHabitId
    ? habitsWithStatus.find((h) => h.id === selectedHabitId)
    : null;
  const detailsHabit = detailsHabitId
    ? habits.find((h) => h.id === detailsHabitId) || null
    : null;

  const handleStatusChange = useCallback(
    async (habitId: string, status: HabitStatus) => {
      await setHabitStatus(habitId, status);
    },
    [setHabitStatus]
  );

  const handleLongPress = useCallback((habitId: string) => {
    setSelectedHabitId(habitId);
  }, []);

  const handleSelectIcon = useCallback(
    async (icon: string) => {
      if (selectedHabitId) {
        await updateHabit(selectedHabitId, { icon });
        setSelectedHabitId(null);
      }
    },
    [selectedHabitId, updateHabit]
  );

  const handleCloseIconPicker = useCallback(() => {
    setSelectedHabitId(null);
  }, []);

  const handleHabitPress = useCallback((habitId: string) => {
    setDetailsHabitId(habitId);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsHabitId(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadHabits();
  }, [loadHabits]);

  const navigateToPreviousDay = useCallback(() => {
    if (canGoToPreviousDay(selectedDate)) {
      setSelectedDate(getPreviousDay(selectedDate));
    }
  }, [selectedDate, setSelectedDate]);

  const navigateToNextDay = useCallback(() => {
    if (canGoToNextDay(selectedDate)) {
      setSelectedDate(getNextDay(selectedDate));
    }
  }, [selectedDate, setSelectedDate]);

  const daySwipeGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        runOnJS(navigateToPreviousDay)();
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(navigateToNextDay)();
      }
    });

  const renderItem = useCallback(
    ({ item }: { item: HabitWithStatus }) => (
      <HabitItem
        habit={item}
        onStatusChange={handleStatusChange}
        onLongPress={handleLongPress}
        onPress={handleHabitPress}
      />
    ),
    [handleStatusChange, handleLongPress, handleHabitPress]
  );

  const keyExtractor = useCallback((item: HabitWithStatus) => item.id, []);

  if (!isLoading && habits.length === 0) {
    return <EmptyState />;
  }

  return (
    <GestureDetector gesture={daySwipeGesture}>
      <View style={styles.container}>
        <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <FlatList
          data={habitsWithStatus}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={<View style={styles.footer} />}
        />

        <IconPicker
          visible={selectedHabitId !== null}
          selectedIcon={selectedHabit?.icon}
          onSelectIcon={handleSelectIcon}
          onClose={handleCloseIconPicker}
        />

        <HabitDetailsModal
          visible={detailsHabitId !== null}
          habit={detailsHabit}
          onClose={handleCloseDetails}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    paddingTop: SPACING.sm,
  },
  footer: {
    height: SPACING.xxl,
  },
});
