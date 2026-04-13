import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import type { Goal, Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { SectionHeader } from '../../components/SectionHeader';
import { TaskRow } from '../../components/TaskRow';
import { TodoEditorModal } from '../../components/TodoEditorModal';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { BodyMedium, Card } from '../../components/ui';
import { SHADOWS, SPACING, TAB_BAR, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';
import { useTodoPlanOutcomeSync } from '../../hooks/useTodoPlanOutcomeSync';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useTodosStore } from '../../stores/useTodosStore';

function getTaskSortDate(todo: Todo) {
  return todo.scheduledDate ?? todo.dueDate;
}

function compareUndatedOpenTodos(a: Todo, b: Todo) {
  const priorityA = a.priority ?? 5;
  const priorityB = b.priority ?? 5;

  return priorityA - priorityB || a.sortOrder - b.sortOrder;
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
    updateTodo,
    setTodoStatus,
    removeTodo,
  } = useTodosStore();
  const { goals, loadGoals } = useGoalsStore();

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showTodoEditor, setShowTodoEditor] = useState(false);
  const [deletedTodo, setDeletedTodo] = useState<Todo | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  const handleToggleTodoStatus = useCallback(
    async (todo: Todo) => {
      const nextStatus: TodoStatus = todo.status === 'completed' ? 'open' : 'completed';
      const updatedTodo = await setTodoStatus(todo.id, nextStatus);

      await syncTodoPlanOutcome(
        todo.scheduledDate,
        updatedTodo.id,
        nextStatus === 'completed' ? 'completed_as_planned' : 'planned'
      );
    },
    [setTodoStatus, syncTodoPlanOutcome]
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
            await syncTodoPlanOutcome(todo.scheduledDate, todo.id, 'canceled');
          },
        },
      ]);
    },
    [setTodoStatus, syncTodoPlanOutcome]
  );

  const handleDeleteTodo = useCallback(
    (todo: Todo) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
            <Card variant="outlined">
              {openTodos.map((todo) => (
                <TaskRow
                  key={todo.id}
                  todo={todo}
                  onToggleStatus={handleToggleTodoStatus}
                  onCancel={handleCancelTodo}
                  onDelete={handleDeleteTodo}
                  onEdit={openTaskEditor}
                  variant="compact"
                />
              ))}
            </Card>
          ) : (
            <Card variant="surface">
              <BodyMedium>
                No open tasks right now. Add one here and schedule it later if you need to.
              </BodyMedium>
            </Card>
          )}

          {completedTodos.length > 0 ? (
            <>
              <SectionHeader
                title="Completed"
                subtitle="Closed out recently"
              />
              <Card variant="outlined">
                {completedTodos.map((todo) => (
                  <TaskRow
                    key={`completed-${todo.id}`}
                    todo={todo}
                    onToggleStatus={handleToggleTodoStatus}
                    onCancel={handleCancelTodo}
                    onDelete={handleDeleteTodo}
                    onEdit={openTaskEditor}
                    variant="compact"
                  />
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>

        <Pressable
          style={[
            styles.fab,
            { bottom: TAB_BAR.height + insets.bottom + SPACING.lg },
          ]}
          onPress={() => openTaskEditor()}
          accessibilityRole="button"
          accessibilityLabel="Add a new task"
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>

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
