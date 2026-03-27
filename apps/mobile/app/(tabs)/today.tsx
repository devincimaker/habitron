import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Goal, GoalDraft } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { MiniCalendar } from '../../components/MiniCalendar';
import { DailyPlanCard } from '../../components/DailyPlanCard';
import { GoalEditorModal } from '../../components/GoalEditorModal';
import { SectionHeader } from '../../components/SectionHeader';
import { BodyMedium, Button, Card, Caption, DisplayMedium, HeadingLarge, Label } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { BORDER_RADIUS, SPACING, type Colors } from '../../constants/theme';
import { formatDateString, formatRelativeDateLabel } from '../../utils/dateUtils';
import { useThemedStyles, useColors } from '../../hooks/useColors';

export default function TodayScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const today = getTodayDate();
  const {
    selectedDate,
    setSelectedDate,
    loadHabits,
    getHabitsWithStatus,
    isLoading: isLoadingHabits,
  } = useHabitsStore();
  const {
    loadTodos,
    getTodosForDate,
    getOverdueTodos,
    isLoading: isLoadingTodos,
  } = useTodosStore();
  const {
    goals,
    loadGoals,
    addGoal,
    updateGoal,
    isLoading: isLoadingGoals,
  } = useGoalsStore();
  const {
    loadEntries,
    getLatestEntryForDate,
    isLoading: isLoadingJournal,
  } = useJournalStore();
  const { plansByDate, loadPlan } = useDailyPlansStore();
  const { isActive, startSession } = useSessionStore();

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const isRefreshing =
    isLoadingHabits || isLoadingTodos || isLoadingGoals || isLoadingJournal;

  const selectedPlan = plansByDate[selectedDate] ?? null;
  const selectedJournalEntry = getLatestEntryForDate(selectedDate);
  const habitsWithStatus = getHabitsWithStatus();
  const todosForDate = useMemo(
    () => getTodosForDate(selectedDate),
    [getTodosForDate, selectedDate]
  );
  const overdueTodos = useMemo(
    () => (selectedDate === today ? getOverdueTodos(selectedDate) : []),
    [getOverdueTodos, selectedDate, today]
  );
  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === 'active'),
    [goals]
  );

  const planCompletionCount = selectedPlan?.items.filter((item) =>
    ['completed_as_planned', 'completed_after_adjustment'].includes(item.outcome)
  ).length ?? 0;
  const completedHabitsCount = habitsWithStatus.filter(
    (habit) => habit.todayStatus === 'completed'
  ).length;
  const openTasksCount = todosForDate.filter((todo) => todo.status === 'open').length;
  const journalSummary = useMemo(() => {
    if (!selectedJournalEntry) {
      return 'No journal entry saved for this day yet';
    }

    const parts = [
      selectedJournalEntry.mood ? `Mood ${selectedJournalEntry.mood}` : null,
      selectedJournalEntry.tags.length > 0
        ? selectedJournalEntry.tags.slice(0, 2).join(' ')
        : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : 'Reflection saved for this day';
  }, [selectedJournalEntry]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadHabits(),
      loadTodos(),
      loadGoals(),
      loadEntries(),
      loadPlan(selectedDate),
    ]);
  }, [loadEntries, loadGoals, loadHabits, loadPlan, loadTodos, selectedDate]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [selectedDate, loadPlan]);

  const handleOpenPlanningSession = useCallback(() => {
    if (!isActive) {
      void startSession();
    }

    router.push('/session?autoPrompt=plan-day');
  }, [isActive, router, startSession]);

  const handleSaveGoal = useCallback(
    async (draft: GoalDraft) => {
      if (editingGoal) {
        await updateGoal(editingGoal.id, draft);
      } else {
        await addGoal(draft);
      }
    },
    [addGoal, editingGoal, updateGoal]
  );

  const openGoalEditor = useCallback((goal?: Goal | null) => {
    setEditingGoal(goal ?? null);
    setShowGoalEditor(true);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshAll}
            tintColor={colors.primary}
          />
        }
      >
        <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <Card style={styles.heroCard}>
          <Caption style={styles.heroEyebrow}>Today</Caption>
          <DisplayMedium>{formatDateString(selectedDate)}</DisplayMedium>
          <BodyMedium style={styles.heroBody}>
            Habitron now treats today as a planning surface, not just a habit checklist.
          </BodyMedium>

          <View style={styles.statsRow}>
            <SummaryStat label="Tasks" value={String(openTasksCount)} />
            <SummaryStat
              label="Plan"
              value={selectedPlan ? `${planCompletionCount}/${selectedPlan.items.length}` : '0'}
            />
            <SummaryStat
              label="Habits"
              value={`${completedHabitsCount}/${habitsWithStatus.length}`}
            />
          </View>
        </Card>

        <DailyPlanCard plan={selectedPlan} onPlanWithCoach={handleOpenPlanningSession} />

        <SectionHeader
          title="Focus Areas"
          subtitle="Jump into the domain you want to manage directly"
        />

        <View style={styles.jumpGrid}>
          <JumpCard
            title="Tasks"
            subtitle={
              overdueTodos.length > 0
                ? `${openTasksCount} scheduled, ${overdueTodos.length} overdue`
                : `${openTasksCount} scheduled for ${selectedDate === today ? 'today' : 'this day'}`
            }
            actionLabel="Open"
            onPress={() => router.push('/tasks')}
          />
          <JumpCard
            title="Habits"
            subtitle={`${completedHabitsCount} completed, ${Math.max(habitsWithStatus.length - completedHabitsCount, 0)} remaining`}
            actionLabel="Open"
            onPress={() => router.push('/habits')}
          />
          <JumpCard
            title="Journal"
            subtitle={journalSummary}
            actionLabel="Open"
            onPress={() => router.push('/journal')}
          />
        </View>

        <SectionHeader
          title="Goals"
          subtitle="Longer arcs that give the coach context"
          actionLabel="Add"
          onPressAction={() => openGoalEditor()}
        />

        {activeGoals.length > 0 ? (
          <View style={styles.goalList}>
            {activeGoals.map((goal) => (
              <Pressable
                key={goal.id}
                onPress={() => openGoalEditor(goal)}
                style={styles.goalCard}
              >
                <HeadingLarge style={styles.goalTitle}>{goal.title}</HeadingLarge>
                {goal.description ? (
                  <BodyMedium numberOfLines={2}>{goal.description}</BodyMedium>
                ) : null}
                <View style={styles.goalMetaRow}>
                  {goal.targetDate ? (
                    <Caption>Target {formatRelativeDateLabel(goal.targetDate)}</Caption>
                  ) : null}
                  {goal.priority ? <Caption>P{goal.priority}</Caption> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card variant="surface">
            <BodyMedium>
              No active goals yet. Add one so your plan has something larger to ladder up to.
            </BodyMedium>
          </Card>
        )}

        <SectionHeader
          title="Journal Snapshot"
          subtitle="Recent reflection should affect the day plan"
          actionLabel="Open"
          onPressAction={() => router.push('/journal')}
        />

        <Card variant="surface">
          {selectedJournalEntry ? (
            <>
              <BodyMedium color={colors.text}>{selectedJournalEntry.content}</BodyMedium>
              {selectedJournalEntry.mood ? (
                <Caption style={styles.diaryMood}>Mood: {selectedJournalEntry.mood}</Caption>
              ) : null}
            </>
          ) : (
            <BodyMedium>
              No journal entry recorded for this day yet.
            </BodyMedium>
          )}
        </Card>
      </ScrollView>

      <GoalEditorModal
        visible={showGoalEditor}
        goal={editingGoal}
        onClose={() => {
          setShowGoalEditor(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
      />
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <Label>{value}</Label>
      <Caption>{label}</Caption>
    </View>
  );
}

function JumpCard({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Card variant="outlined" style={styles.jumpCard}>
      <HeadingLarge>{title}</HeadingLarge>
      <BodyMedium style={styles.jumpCopy}>{subtitle}</BodyMedium>
      <Button title={actionLabel} onPress={onPress} size="sm" variant="outline" />
    </Card>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  heroCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBody: {
    marginTop: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  jumpGrid: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  jumpCard: {
    marginBottom: 0,
  },
  jumpCopy: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  goalList: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  goalTitle: {
    marginBottom: SPACING.xs,
  },
  goalMetaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  diaryMood: {
    marginTop: SPACING.sm,
  },
});
