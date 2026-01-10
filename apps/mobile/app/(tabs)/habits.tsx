import { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { HabitItem } from '../../components/HabitItem';
import { EmptyState } from '../../components/EmptyState';
import { HabitStatus, HabitWithStatus } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING } from '../../constants/theme';

export default function HabitsScreen() {
  const { habits, isLoading, loadHabits, setHabitStatus, getHabitsWithStatus } =
    useHabitsStore();

  const habitsWithStatus = getHabitsWithStatus();

  const handleStatusChange = useCallback(
    async (habitId: string, status: HabitStatus) => {
      await setHabitStatus(habitId, status);
    },
    [setHabitStatus]
  );

  const handleRefresh = useCallback(async () => {
    await loadHabits();
  }, [loadHabits]);

  const renderItem = useCallback(
    ({ item }: { item: HabitWithStatus }) => (
      <HabitItem habit={item} onStatusChange={handleStatusChange} />
    ),
    [handleStatusChange]
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

      <View style={styles.swipeHint}>
        <Text style={styles.hintText}>
          Swipe right to complete • Swipe left to skip
        </Text>
      </View>
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
  swipeHint: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  hintText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
