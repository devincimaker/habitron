import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Goal, Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { TaskCalendar } from '../../components/TaskCalendar';
import { SectionHeader } from '../../components/SectionHeader';
import { TaskRow } from '../../components/TaskRow';
import { TodoEditorModal } from '../../components/TodoEditorModal';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { BodyMedium, Card } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { SPACING, type Colors } from '../../constants/theme';
import { useThemedStyles, useColors } from '../../hooks/useColors';

export default function TasksScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const today = getTodayDate();
  const { selectedDate, setSelectedDate } = useHabitsStore();
  const {
    todos,
    lists,
    isLoading,
    loadTodos,
    addTodo,
    updateTodo,
    setTodoStatus,
    removeTodo,
    getTodosForDate,
    getOverdueTodos,
  } = useTodosStore();
  const { goals, loadGoals } = useGoalsStore();
  const { plansByDate, loadPlan, updateOutcomeForTodo } = useDailyPlansStore();

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showTodoEditor, setShowTodoEditor] = useState(false);
  const [deletedTodo, setDeletedTodo] = useState<Todo | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectedPlan = plansByDate[selectedDate] ?? null;
  const scheduledTodos = useMemo(
    () => getTodosForDate(selectedDate),
    [getTodosForDate, selectedDate, todos]
  );
  const overdueTodos = useMemo(
    () => (selectedDate === today ? getOverdueTodos(selectedDate) : []),
    [getOverdueTodos, selectedDate, todos, today]
  );
  const unscheduledTodos = useMemo(
    () => todos.filter((todo) => todo.status === 'open' && !todo.scheduledDate),
    [todos]
  );
  const openScheduledTodos = scheduledTodos.filter((todo) => todo.status === 'open');
  const completedScheduledTodos = scheduledTodos.filter((todo) => todo.status === 'completed');

  const taskDatesWithDots = useMemo(() => {
    const dates = new Set<string>();
    for (const todo of todos) {
      if (todo.scheduledDate && todo.status === 'open') {
        dates.add(todo.scheduledDate);
      }
    }
    return dates;
  }, [todos]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTodos(), loadGoals(), loadPlan(selectedDate)]);
  }, [loadGoals, loadPlan, loadTodos, selectedDate]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [selectedDate, loadPlan]);

  const handleSaveTodo = useCallback(
    async (draft: TodoDraft) => {
      if (editingTodo) {
        const updatedTodo = await updateTodo(editingTodo.id, draft);

        if (
          editingTodo.scheduledDate === selectedDate &&
          updatedTodo.scheduledDate &&
          updatedTodo.scheduledDate !== selectedDate &&
          selectedPlan
        ) {
          await updateOutcomeForTodo(selectedDate, updatedTodo.id, 'deferred');
        }
      } else {
        await addTodo(draft);
      }
    },
    [addTodo, editingTodo, selectedDate, selectedPlan, updateOutcomeForTodo, updateTodo]
  );

  const handleToggleTodoStatus = useCallback(
    async (todo: Todo) => {
      const nextStatus: TodoStatus = todo.status === 'completed' ? 'open' : 'completed';
      const updatedTodo = await setTodoStatus(todo.id, nextStatus);

      if (selectedPlan) {
        await updateOutcomeForTodo(
          selectedDate,
          updatedTodo.id,
          nextStatus === 'completed' ? 'completed_as_planned' : 'planned'
        );
      }
    },
    [selectedDate, selectedPlan, setTodoStatus, updateOutcomeForTodo]
  );

  const handleCancelTodo = useCallback(
    async (todo: Todo) => {
      Alert.alert('Cancel Task', `Cancel "${todo.title}"?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Task',
          style: 'destructive',
          onPress: async () => {
            await setTodoStatus(todo.id, 'canceled');
            if (selectedPlan) {
              await updateOutcomeForTodo(selectedDate, todo.id, 'canceled');
            }
          },
        },
      ]);
    },
    [selectedDate, selectedPlan, setTodoStatus, updateOutcomeForTodo]
  );

  const handleMoveTodo = useCallback(
    async (todo: Todo, nextDate: string) => {
      Haptics.selectionAsync();
      await updateTodo(todo.id, { scheduledDate: nextDate });

      if (selectedPlan) {
        await updateOutcomeForTodo(selectedDate, todo.id, 'deferred');
      }
    },
    [selectedDate, selectedPlan, updateOutcomeForTodo, updateTodo]
  );

  const handleDeleteTodo = useCallback(
    (todo: Todo) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setDeletedTodo(todo);
      void removeTodo(todo.id);
    },
    [removeTodo]
  );

  const handleUndoDelete = useCallback(() => {
    if (!deletedTodo) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    void addTodo({
      title: deletedTodo.title,
      notes: deletedTodo.notes,
      priority: deletedTodo.priority,
      dueDate: deletedTodo.dueDate,
      scheduledDate: deletedTodo.scheduledDate,
      scheduledBlock: deletedTodo.scheduledBlock,
      estimateMinutes: deletedTodo.estimateMinutes,
      goalId: deletedTodo.goalId,
      tagIds: deletedTodo.tags.map((tag) => tag.id),
      listId: deletedTodo.listId,
    });
    setDeletedTodo(null);
  }, [addTodo, deletedTodo]);

  const openTaskEditor = useCallback((todo?: Todo | null) => {
    setEditingTodo(todo ?? null);
    setShowTodoEditor(true);
  }, []);

  return (
    <View style={styles.container}>
      <TaskCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        taskDatesWithDots={taskDatesWithDots}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshAll}
            tintColor={colors.primary}
          />
        }
      >

        <SectionHeader
          title="Scheduled"
          subtitle={selectedDate === today ? 'Tasks assigned to today' : 'Tasks assigned to this day'}
          actionLabel="Add"
          onPressAction={() => openTaskEditor()}
        />

        {overdueTodos.length > 0 ? (
          <Card variant="outlined">
            {overdueTodos.map((todo) => (
              <TaskRow
                key={`overdue-${todo.id}`}
                todo={todo}
                onToggleStatus={handleToggleTodoStatus}
                onMoveTomorrow={handleMoveTodo}
                onCancel={handleCancelTodo}
                onDelete={handleDeleteTodo}
                onEdit={openTaskEditor}
                selectedDate={selectedDate}
              />
            ))}
          </Card>
        ) : null}

        {openScheduledTodos.length > 0 ? (
          <Card variant="outlined">
            {openScheduledTodos.map((todo) => (
              <TaskRow
                key={todo.id}
                todo={todo}
                onToggleStatus={handleToggleTodoStatus}
                onMoveTomorrow={handleMoveTodo}
                onCancel={handleCancelTodo}
                onDelete={handleDeleteTodo}
                onEdit={openTaskEditor}
                selectedDate={selectedDate}
              />
            ))}
          </Card>
        ) : (
          <Card variant="surface">
            <BodyMedium>
              No open tasks scheduled here yet. Add one directly or ask Habitron to plan the day.
            </BodyMedium>
          </Card>
        )}

        {completedScheduledTodos.length > 0 ? (
          <>
            <SectionHeader
              title="Completed"
              subtitle="Things already closed out for this day"
            />
            <Card variant="outlined">
              {completedScheduledTodos.map((todo) => (
                <TaskRow
                  key={`completed-${todo.id}`}
                  todo={todo}
                  onToggleStatus={handleToggleTodoStatus}
                  onMoveTomorrow={handleMoveTodo}
                  onCancel={handleCancelTodo}
                  onDelete={handleDeleteTodo}
                  onEdit={openTaskEditor}
                  selectedDate={selectedDate}
                />
              ))}
            </Card>
          </>
        ) : null}

        <SectionHeader
          title="Unscheduled"
          subtitle="Open tasks waiting to be placed on the calendar"
        />

        {unscheduledTodos.length > 0 ? (
          <Card variant="outlined">
            {unscheduledTodos.map((todo) => (
              <TaskRow
                key={`unscheduled-${todo.id}`}
                todo={todo}
                onToggleStatus={handleToggleTodoStatus}
                onMoveTomorrow={handleMoveTodo}
                onCancel={handleCancelTodo}
                onDelete={handleDeleteTodo}
                onEdit={openTaskEditor}
                selectedDate={selectedDate}
              />
            ))}
          </Card>
        ) : (
          <Card variant="surface">
            <BodyMedium>
              No open unscheduled tasks right now.
            </BodyMedium>
          </Card>
        )}
      </ScrollView>

      <TodoEditorModal
        visible={showTodoEditor}
        todo={editingTodo}
        lists={lists}
        goals={goals as Goal[]}
        onClose={() => {
          setShowTodoEditor(false);
          setEditingTodo(null);
        }}
        onSave={handleSaveTodo}
      />

      {deletedTodo ? (
        <UndoSnackbar
          message={`"${deletedTodo.title}" deleted`}
          onUndo={handleUndoDelete}
          onDismiss={() => setDeletedTodo(null)}
        />
      ) : null}
    </View>
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
});
