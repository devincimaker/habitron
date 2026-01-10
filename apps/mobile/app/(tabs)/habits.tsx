import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { HabitItem } from '../../components/HabitItem';
import { IconPicker } from '../../components/IconPicker';
import { EmptyState } from '../../components/EmptyState';
import { HabitStatus, HabitWithStatus } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING } from '../../constants/theme';

export default function HabitsScreen() {
  const { habits, isLoading, loadHabits, setHabitStatus, updateHabit, getHabitsWithStatus } =
    useHabitsStore();

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  const habitsWithStatus = getHabitsWithStatus();
  const selectedHabit = selectedHabitId
    ? habitsWithStatus.find(h => h.id === selectedHabitId)
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

  const handleSelectIcon = useCallback(async (icon: string) => {
    if (selectedHabitId) {
      await updateHabit(selectedHabitId, { icon });
      setSelectedHabitId(null);
    }
  }, [selectedHabitId, updateHabit]);

  const handleCloseIconPicker = useCallback(() => {
    setSelectedHabitId(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadHabits();
  }, [loadHabits]);

  const renderItem = useCallback(
    ({ item }: { item: HabitWithStatus }) => (
      <HabitItem
        habit={item}
        onStatusChange={handleStatusChange}
        onLongPress={handleLongPress}
      />
    ),
    [handleStatusChange, handleLongPress]
  );

  const keyExtractor = useCallback((item: HabitWithStatus) => item.id, []);

  if (!isLoading && habits.length === 0) {
    return <EmptyState />;
  }

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const completedCount = habitsWithStatus.filter(
    (h) => h.todayStatus === 'completed'
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{dateString}</Text>
        <Text style={styles.progress}>
          {completedCount} of {habits.length} completed
        </Text>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  date: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  progress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  list: {
    paddingTop: SPACING.sm,
  },
  footer: {
    height: SPACING.xxl,
  },
});
