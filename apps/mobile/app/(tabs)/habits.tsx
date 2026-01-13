import { useCallback, useState, useRef, useEffect } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useHabitsStore } from "../../stores/useHabitsStore";
import { HabitItem } from "../../components/HabitItem";
import { IconPicker } from "../../components/IconPicker";
import { HabitDetailsModal } from "../../components/HabitDetailsModal";
import { EmptyState } from "../../components/EmptyState";
import { MiniCalendar } from "../../components/MiniCalendar";
import { HabitStatus, HabitWithStatus } from "@habits-coach/shared";
import { COLORS, SPACING } from "../../constants/theme";
import {
  canGoToPreviousDay,
  canGoToNextDay,
  getPreviousDay,
  getNextDay,
} from "../../utils/dateUtils";

const SWIPE_THRESHOLD = 25;
const SLIDE_DISTANCE = 20;
const ANIMATION_DURATION = 200;

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
  const previousDateRef = useRef(selectedDate);

  // Animation values for list transition
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Animate when date changes
  useEffect(() => {
    if (previousDateRef.current !== selectedDate) {
      const goingForward = selectedDate > previousDateRef.current;
      const direction = goingForward ? -1 : 1;

      // Quick slide out and fade, then slide in from opposite side
      translateX.value = withSequence(
        withTiming(direction * SLIDE_DISTANCE, {
          duration: ANIMATION_DURATION / 2,
          easing: Easing.out(Easing.ease),
        }),
        withTiming(-direction * SLIDE_DISTANCE, { duration: 0 }),
        withTiming(0, {
          duration: ANIMATION_DURATION / 2,
          easing: Easing.out(Easing.ease),
        })
      );

      opacity.value = withSequence(
        withTiming(0.3, { duration: ANIMATION_DURATION / 2 }),
        withTiming(1, { duration: ANIMATION_DURATION / 2 })
      );

      previousDateRef.current = selectedDate;
    }
  }, [selectedDate, translateX, opacity]);

  const listAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

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
        <MiniCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <Animated.View style={[styles.listContainer, listAnimatedStyle]}>
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
        </Animated.View>

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
  listContainer: {
    flex: 1,
  },
  list: {
    paddingTop: SPACING.sm,
  },
  footer: {
    height: SPACING.xxl,
  },
});
