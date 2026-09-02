import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { Todo } from '@habits-coach/shared';
import { GoalSheet } from '../../components/GoalSheet';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import {
  BORDER_RADIUS,
  SPACING,
  STATUS_INDICATOR,
  TASK_SCHEDULED,
  TOUCH_TARGET,
  TYPOGRAPHY,
  type Colors,
} from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';
import { getTodayDate } from '@habits-coach/shared';
import { formatSheetDate } from '../../utils/dateUtils';
import {
  countGoalTasks,
  describeDaysLeft,
  describeReviewedAt,
  formatGoalDate,
  isGoalOpen,
  toLocalDateString,
} from '../../utils/goals';

const reportSaveFailure = () => Alert.alert('Could not save the goal', 'Please try again.');
const reportDeleteFailure = () => Alert.alert('Could not delete the goal', 'Please try again.');

/** One goal, whole: its date, its measure, and the tasks that move it. */
export default function GoalDetailScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = getTodayDate();

  const goal = useGoalsStore((state) => state.goals.find((item) => item.id === id) ?? null);
  const updateGoal = useGoalsStore((state) => state.updateGoal);
  const setGoalDone = useGoalsStore((state) => state.setGoalDone);
  const deleteGoal = useGoalsStore((state) => state.deleteGoal);
  const todos = useTodosStore((state) => state.todos);

  const [editing, setEditing] = useState(false);

  const tasks = useMemo(
    () => todos.filter((todo) => todo.goalId === id && todo.status !== 'canceled'),
    [todos, id]
  );
  const counts = countGoalTasks(id, todos);

  const openTask = useCallback(
    (todo: Todo) => router.push({ pathname: '/task/[id]', params: { id: todo.id } }),
    [router]
  );

  // The route can outlive its goal: deleting one leaves the screen mounted for
  // a frame, and a stale deep link may name a goal that is gone.
  if (!goal) return <View style={styles.container} />;

  const open = isGoalOpen(goal);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goal</Text>
        <TouchableOpacity
          onPress={() => setEditing(true)}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Edit goal"
        >
          <Feather name="edit-2" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusLine}>
          <Pressable
            style={[styles.circle, !open && styles.circleDone]}
            onPress={() => void setGoalDone(goal.id, open).catch(reportSaveFailure)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !open }}
            accessibilityLabel={open ? 'Mark goal done' : 'Reopen goal'}
          >
            {!open ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
          </Pressable>
          <Text style={[styles.dateText, !open && styles.dateTextDone]}>
            {open
              ? `${formatGoalDate(goal.targetDate)} · ${describeDaysLeft(goal.targetDate, today)}`
              : `Done ${formatGoalDate(toLocalDateString(goal.completedAt ?? 0))}`}
          </Text>
        </View>
        <Text style={styles.reviewed}>{describeReviewedAt(goal, today)}</Text>

        <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit goal">
          <Text style={[styles.title, !open && styles.titleDone]}>{goal.title}</Text>
          <Text style={styles.sectionLabel}>How I’ll know</Text>
          <Text style={styles.measure}>{goal.measure}</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>
          {tasks.length > 0 ? `Tasks · ${counts.done} of ${counts.total} done` : 'Tasks'}
        </Text>
        {tasks.length === 0 ? (
          <Text style={styles.emptyTasks}>
            No tasks point here yet. Link one from its sheet, or ask the coach.
          </Text>
        ) : (
          <View style={styles.taskList}>
            {tasks.map((todo) => {
              const done = todo.status === 'completed';
              return (
                <Pressable
                  key={todo.id}
                  style={styles.taskRow}
                  onPress={() => openTask(todo)}
                  accessibilityRole="button"
                  accessibilityLabel={todo.title}
                >
                  <View style={[styles.taskCircle, done && styles.taskCircleDone]}>
                    {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                  </View>
                  <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
                    {todo.title}
                  </Text>
                  {todo.scheduledDate ? (
                    <Text style={styles.taskDate}>{formatSheetDate(todo.scheduledDate)}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <GoalSheet
        visible={editing}
        goal={goal}
        onClose={() => setEditing(false)}
        onSave={(draft) => {
          setEditing(false);
          void updateGoal(goal.id, draft).catch(reportSaveFailure);
        }}
        onDelete={() => {
          setEditing(false);
          router.back();
          void deleteGoal(goal.id).catch(reportDeleteFailure);
        }}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.lg,
    },
    statusLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm + 4,
    },
    circle: {
      width: STATUS_INDICATOR.size,
      height: STATUS_INDICATOR.size,
      borderRadius: STATUS_INDICATOR.borderRadius,
      borderWidth: STATUS_INDICATOR.borderWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    dateText: {
      ...TYPOGRAPHY.label,
      color: TASK_SCHEDULED,
    },
    dateTextDone: {
      color: colors.textSecondary,
    },
    reviewed: {
      ...TYPOGRAPHY.caption,
      color: colors.textLight,
      marginTop: SPACING.xs,
      marginLeft: STATUS_INDICATOR.size + SPACING.sm + 4,
      marginBottom: SPACING.md,
    },
    title: {
      ...TYPOGRAPHY.displayMedium,
      color: colors.textStrong,
      marginBottom: SPACING.md,
    },
    titleDone: {
      color: colors.textSecondary,
    },
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: SPACING.xs,
    },
    measure: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      marginBottom: SPACING.lg,
    },
    emptyTasks: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textLight,
    },
    taskList: {
      gap: SPACING.xs,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm + 4,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.sm + 4,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
    },
    taskCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taskCircleDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    taskTitle: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      flex: 1,
    },
    taskTitleDone: {
      color: colors.textLight,
      textDecorationLine: 'line-through',
    },
    taskDate: {
      ...TYPOGRAPHY.caption,
      color: colors.textLight,
    },
  });
