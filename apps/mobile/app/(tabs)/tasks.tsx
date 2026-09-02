import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
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
import type { Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { TaskDragList } from '../../components/TaskDragList';
import { TaskDragOverlay } from '../../components/TaskDragOverlay';
import { TaskListsDrawerEdgeSwipe } from '../../components/TaskListsDrawerEdgeSwipe';
import { TaskQuickCreateSheet } from '../../components/TaskQuickCreateSheet';
import { TaskRescheduleModal } from '../../components/TaskRescheduleModal';
import { TaskRow, type TaskStatusToggleOptions } from '../../components/TaskRow';
import { TaskSectionCard } from '../../components/TaskSectionCard';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { BodyMedium, Card } from '../../components/ui';
import { HEADER, SHADOWS, SPACING, TAB_BAR, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';
import { useTaskListDrag } from '../../hooks/useTaskListDrag';
import { useUndoableTodoRemoval } from '../../hooks/useUndoableTodoRemoval';
import { useTodoPlanOutcomeSync } from '../../hooks/useTodoPlanOutcomeSync';
import { useTaskListsUiStore } from '../../stores/useTaskListsUiStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { getTodoPlanOutcomeForStatus } from '../../utils/todoPlanOutcome';

function compareCompletedTodos(a: Todo, b: Todo) {
  const completedAtA = a.completedAt ?? a.updatedAt;
  const completedAtB = b.completedAt ?? b.updatedAt;

  return completedAtB - completedAtA;
}

export default function TasksScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const {
    todos,
    lists,
    isLoading,
    loadTodos,
    addTodoOptimistic,
    setTodoStatusOptimistic,
    reorderTodos,
  } = useTodosStore();
  const activeListId = useTaskListsUiStore((state) => state.activeListId);
  const openDrawer = useTaskListsUiStore((state) => state.openDrawer);

  const [reschedulingTodo, setReschedulingTodo] = useState<Todo | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const { removedTodo, removeTodo, undoRemoveTodo, dismissRemovedTodo } = useUndoableTodoRemoval();
  const activeList = useMemo(
    () => lists.find((list) => list.id === activeListId) ?? lists.find((list) => list.isInbox),
    [lists, activeListId]
  );
  const openTodos = useMemo(
    () =>
      todos.filter(
        (todo) => todo.status === 'open' && (!activeList || todo.listId === activeList.id)
      ),
    [todos, activeList]
  );
  const completedTodos = useMemo(
    () =>
      todos
        .filter(
          (todo) => todo.status === 'completed' && (!activeList || todo.listId === activeList.id)
        )
        .sort(compareCompletedTodos),
    [todos, activeList]
  );
  const { rootRef, onRootLayout, dragState, start, move, end, list } = useTaskListDrag({
    items: openTodos,
    onReorder: reorderTodos,
  });

  const refreshAll = useCallback(async () => {
    await loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

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

  const openTaskSheet = useCallback(
    (todo: Todo) => router.push({ pathname: '/task/[id]', params: { id: todo.id } }),
    [router]
  );

  return (
    <>
      <Tabs.Screen
        options={{
          title: 'Tasks',
          headerTitle: activeList?.name ?? 'Inbox',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <HeaderIconButton
                name="menu-outline"
                accessibilityLabel="Open lists"
                onPress={openDrawer}
              />
            </View>
          ),
        }}
      />

      <TaskListsDrawerEdgeSwipe>
      <View ref={rootRef} onLayout={onRootLayout} style={styles.container}>
        <ScrollView
          style={styles.scroll}
          scrollEnabled={!dragState}
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
              <TaskDragList
                items={openTodos}
                drag={list}
                renderRow={(todo, index) => (
                  <TaskRow
                    todo={todo}
                    onToggleStatus={handleToggleTodoStatus}
                    onRemove={removeTodo}
                    onEdit={openTaskSheet}
                    onReschedule={setReschedulingTodo}
                    onDragStart={start}
                    onDragMove={move}
                    onDragEnd={end}
                    isDragging={dragState?.todo.id === todo.id}
                    variant="compact"
                    isLast={index === openTodos.length - 1}
                  />
                )}
              />
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
              {() => completedTodos.map((todo, index) => (
                <TaskRow
                  key={`completed-${todo.id}`}
                  todo={todo}
                  onToggleStatus={handleToggleTodoStatus}
                  onRemove={removeTodo}
                  onEdit={openTaskSheet}
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
          defaultListId={activeList?.id}
        />

        <TaskRescheduleModal
          todo={reschedulingTodo}
          onClose={() => setReschedulingTodo(null)}
        />

        {removedTodo ? (
          <UndoSnackbar
            message={`"${removedTodo.title}" removed`}
            onUndo={undoRemoveTodo}
            onDismiss={dismissRemovedTodo}
          />
        ) : null}

        <TaskDragOverlay dragState={dragState} />
      </View>
      </TaskListsDrawerEdgeSwipe>
    </>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // The mirror of ProfileHeaderButton's marginRight: a custom headerLeft gets
  // no inset from the navigator, so without this the control touches the bezel.
  headerLeft: {
    marginLeft: HEADER.edgeMargin,
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
