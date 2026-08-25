import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from 'expo-router';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Goal, Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { TaskQuickCreateSheet } from '../../components/TaskQuickCreateSheet';
import { TaskRescheduleModal } from '../../components/TaskRescheduleModal';
import { TaskRow, type TaskStatusToggleOptions } from '../../components/TaskRow';
import { TaskSectionCard } from '../../components/TaskSectionCard';
import { TodoEditorModal } from '../../components/TodoEditorModal';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { BodyMedium, Card } from '../../components/ui';
import { SHADOWS, SPACING, TAB_BAR, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';
import { useUndoableTodoRemoval } from '../../hooks/useUndoableTodoRemoval';
import { useTodoPlanOutcomeSync } from '../../hooks/useTodoPlanOutcomeSync';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { getTodoPlanOutcomeForStatus } from '../../utils/todoPlanOutcome';
import { compareTodoScheduledTimes } from '../../utils/todoTime';

function getTaskSortDate(todo: Todo) {
  return todo.scheduledDate ?? todo.dueDate;
}

function compareUndatedOpenTodos(a: Todo, b: Todo) {
  const priorityA = a.priority ?? 5;
  const priorityB = b.priority ?? 5;

  return compareTodoScheduledTimes(a.scheduledTime, b.scheduledTime) || priorityA - priorityB || a.sortOrder - b.sortOrder;
}

function compareOpenTodos(a: Todo, b: Todo) {
  const sortDateA = getTaskSortDate(a);
  const sortDateB = getTaskSortDate(b);

  if (sortDateA && sortDateB) {
    return sortDateA.localeCompare(sortDateB) || compareUndatedOpenTodos(a, b);
  }

  if (sortDateA) return -1;
  if (sortDateB) return 1;

  return compareUndatedOpenTodos(a, b);
}

function compareCompletedTodos(a: Todo, b: Todo) {
  const completedAtA = a.completedAt ?? a.updatedAt;
  const completedAtB = b.completedAt ?? b.updatedAt;

  return completedAtB - completedAtA;
}

export default function TasksScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const {
    todos,
    lists,
    isLoading,
    loadTodos,
    addTodo,
    addTodoOptimistic,
    updateTodo,
    setTodoStatusOptimistic,
  } = useTodosStore();
  const { goals, loadGoals } = useGoalsStore();

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [reschedulingTodo, setReschedulingTodo] = useState<Todo | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showTodoEditor, setShowTodoEditor] = useState(false);
  const { removedTodo, removeTodo, undoRemoveTodo, dismissRemovedTodo } = useUndoableTodoRemoval();
  const openTodos = useMemo(
    () =>
      todos
        .filter((todo) => todo.status === 'open')
        .sort(compareOpenTodos),
    [todos]
  );
  const completedTodos = useMemo(
    () => todos.filter((todo) => todo.status === 'completed').sort(compareCompletedTodos),
    [todos]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTodos(), loadGoals()]);
  }, [loadGoals, loadTodos]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleSaveTodo = useCallback(
    async (draft: TodoDraft) => {
      if (editingTodo) {
        const previousScheduledDate = editingTodo.scheduledDate;
        const updatedTodo = await updateTodo(editingTodo.id, draft);

        if (previousScheduledDate && updatedTodo.scheduledDate !== previousScheduledDate) {
          await syncTodoPlanOutcome(previousScheduledDate, updatedTodo.id, 'deferred');
        }
      } else {
        await addTodo(draft);
      }
    },
    [addTodo, editingTodo, syncTodoPlanOutcome, updateTodo]
  );

  const handleQuickCreate = useCallback(
    async (draft: TodoDraft) => {
      void addTodoOptimistic(draft).catch((error) => {
        console.warn('Failed to create todo:', error);
        Alert.alert('Could not create task', 'Please try again.');
      });
    },
    [addTodoOptimistic]
  );

  const handleToggleTodoStatus = useCallback(
    async (todo: Todo, options?: TaskStatusToggleOptions) => {
      try {
        const nextStatus: TodoStatus = todo.status === 'completed' ? 'open' : 'completed';
        const updatedTodo = await setTodoStatusOptimistic(todo.id, nextStatus, options);

        await syncTodoPlanOutcome(
          todo.scheduledDate,
          updatedTodo.id,
          getTodoPlanOutcomeForStatus(nextStatus)
        );
      } catch (error) {
        console.warn('Failed to update todo status:', error);
        Alert.alert('Could not update task', 'Please try again.');
      }
    },
    [setTodoStatusOptimistic, syncTodoPlanOutcome]
  );

  const openTaskEditor = useCallback((todo?: Todo | null) => {
    setEditingTodo(todo ?? null);
    setShowTodoEditor(true);
  }, []);

  return (
    <>
      <Tabs.Screen
        options={{
          title: 'Tasks',
          headerTitle: 'Inbox',
        }}
      />

      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: TAB_BAR.height + insets.bottom + 72 + SPACING.xl,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshAll}
              tintColor={colors.primary}
            />
          }
        >
          {openTodos.length > 0 ? (
            <TaskSectionCard>
              {openTodos.map((todo, index) => (
                <TaskRow
                  key={todo.id}
                  todo={todo}
                  onToggleStatus={handleToggleTodoStatus}
                  onRemove={removeTodo}
                  onEdit={openTaskEditor}
                  onReschedule={setReschedulingTodo}
                  variant="compact"
                  isLast={index === openTodos.length - 1}
                />
              ))}
            </TaskSectionCard>
          ) : (
            <Card variant="surface" style={styles.emptyCard}>
              <BodyMedium>
                No open tasks right now. Add one here and schedule it later if you need to.
              </BodyMedium>
            </Card>
          )}

          {completedTodos.length > 0 ? (
            <TaskSectionCard
              title="Completed"
              count={completedTodos.length}
              collapsible
              defaultExpanded={false}
              dimContent
            >
              {completedTodos.map((todo, index) => (
                <TaskRow
                  key={`completed-${todo.id}`}
                  todo={todo}
                  onToggleStatus={handleToggleTodoStatus}
                  onRemove={removeTodo}
                  onEdit={openTaskEditor}
                  onReschedule={setReschedulingTodo}
                  variant="compact"
                  isLast={index === completedTodos.length - 1}
                />
              ))}
            </TaskSectionCard>
          ) : null}
        </ScrollView>

        <Pressable
          style={[
            styles.fab,
            { bottom: TAB_BAR.height + insets.bottom + SPACING.lg },
          ]}
          onPress={() => setShowQuickCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a new task"
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>

        <TaskQuickCreateSheet
          visible={showQuickCreate}
          onClose={() => setShowQuickCreate(false)}
          onSave={handleQuickCreate}
        />

        <TaskRescheduleModal
          todo={reschedulingTodo}
          onClose={() => setReschedulingTodo(null)}
        />

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

        {removedTodo ? (
          <UndoSnackbar
            message={`"${removedTodo.title}" removed`}
            onUndo={undoRemoveTodo}
            onDismiss={dismissRemovedTodo}
          />
        ) : null}
      </View>
    </>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: SPACING.sm,
  },
  emptyCard: {
    marginHorizontal: SPACING.md,
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
