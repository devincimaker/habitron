import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type {
  Goal,
  Habit,
  HabitDraft,
  HabitStatus,
} from '@habits-coach/shared';
import { IconPicker } from '../../components/IconPicker';
import { HabitEditorModal } from '../../components/HabitEditorModal';
import { HabitItem } from '../../components/HabitItem';
import { MiniCalendar } from '../../components/MiniCalendar';
import { SectionHeader } from '../../components/SectionHeader';
import { BodyMedium, Card, Caption, Label } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { BORDER_RADIUS, COLORS, SPACING } from '../../constants/theme';

export default function HabitsScreen() {
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

  const habitsWithStatus = getHabitsWithStatus();
  const selectedPlan = plansByDate[selectedDate] ?? null;
  const completedCount = useMemo(
    () => habitsWithStatus.filter((habit) => habit.todayStatus === 'completed').length,
    [habitsWithStatus]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([loadHabits(), loadGoals(), loadPlan(selectedDate)]);
  }, [loadGoals, loadHabits, loadPlan, selectedDate]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [selectedDate, loadPlan]);

  const handleStatusChange = useCallback(
    async (habitId: string, status: HabitStatus) => {
      await setHabitStatus(habitId, status);

      if (selectedPlan) {
        await updateOutcomeForHabit(
          selectedDate,
          habitId,
          status === 'completed' ? 'completed_as_planned' : 'not_done'
        );
      }
    },
    [selectedDate, selectedPlan, setHabitStatus, updateOutcomeForHabit]
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

  const selectedHabit = iconPickerHabitId
    ? habitsWithStatus.find((habit) => habit.id === iconPickerHabitId)
    : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshAll}
            tintColor={COLORS.primary}
          />
        }
      >
        <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <Card style={styles.summaryCard}>
          <Label>{completedCount}/{habitsWithStatus.length}</Label>
          <Caption>
            Habits completed for {selectedDate}. Long-press an icon to change it, or tap a habit to edit details.
          </Caption>
        </Card>

        <SectionHeader
          title="Habits"
          subtitle="Recurring commitments that still shape the plan"
          actionLabel="Add"
          onPressAction={() => openHabitEditor()}
        />

        {habits.length > 0 ? (
          <View style={styles.habitList}>
            {habitsWithStatus.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                onStatusChange={handleStatusChange}
                onLongPress={setIconPickerHabitId}
                onPress={(habitId) => {
                  const selected = habits.find((candidate) => candidate.id === habitId);
                  if (selected) {
                    openHabitEditor(selected);
                  }
                }}
              />
            ))}
          </View>
        ) : (
          <Card variant="surface">
            <BodyMedium>
              You do not have any habits yet. Add one here or let Habitron suggest one in a session.
            </BodyMedium>
          </Card>
        )}
      </ScrollView>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  summaryCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  habitList: {
    paddingHorizontal: SPACING.md,
  },
});
