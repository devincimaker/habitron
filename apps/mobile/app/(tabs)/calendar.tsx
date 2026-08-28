/* eslint-disable max-lines -- HAB-89: split pending */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import type { Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { TaskCalendar, type TaskCalendarRef } from '../../components/TaskCalendar';
import { TaskDragList } from '../../components/TaskDragList';
import { TaskDragOverlay } from '../../components/TaskDragOverlay';
import { TaskQuickCreateSheet } from '../../components/TaskQuickCreateSheet';
import { TaskRescheduleModal } from '../../components/TaskRescheduleModal';
import {
  TaskRow,
  type TaskStatusToggleOptions,
  type TaskRowDragMoveEvent,
  type TaskRowDragStartEvent,
} from '../../components/TaskRow';
import { TaskSectionCard } from '../../components/TaskSectionCard';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { Caption } from '../../components/ui';
import { SHADOWS, SPACING, TAB_BAR, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';
import { useTaskListDrag } from '../../hooks/useTaskListDrag';
import { useUndoableTodoRemoval } from '../../hooks/useUndoableTodoRemoval';
import { useTodoPlanOutcomeSync } from '../../hooks/useTodoPlanOutcomeSync';
import { useTodoReschedule } from '../../hooks/useTodoReschedule';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { formatRelativeDateLabel, getMonthDisplayString } from '../../utils/dateUtils';
import { getTodoPlanOutcomeForStatus } from '../../utils/todoPlanOutcome';

export default function CalendarScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = getTodayDate();
  const taskCalendarRef = useRef<TaskCalendarRef>(null);
  const dragHoverDateRef = useRef<string | null>(null);
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const { selectedDate, setSelectedDate } = useHabitsStore();
  const {
    todos,
    isLoading,
    loadTodos,
    addTodoOptimistic,
    setTodoStatusOptimistic,
    reorderTodos,
    getTodosForDate,
    getOverdueTodos,
  } = useTodosStore();
  const { loadPlan } = useDailyPlansStore();

  const [reschedulingTodo, setReschedulingTodo] = useState<Todo | null>(null);
  const rescheduleTodo = useTodoReschedule();
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const { removedTodo, removeTodo, undoRemoveTodo, dismissRemovedTodo } = useUndoableTodoRemoval();
  const [dragHoverDate, setDragHoverDate] = useState<string | null>(null);
  // Dragging a task re-renders this screen every pointer frame, so keep the
  // date formatting off that path. `today` is a dependency even though the util
  // reads it itself: without it the label stays on "Today" past midnight.
  const selectedDateLabel = useMemo(
    () => formatRelativeDateLabel(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- today is read inside the util
    [selectedDate, today],
  );
  const headerTitle = useMemo(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');

    if (date.getFullYear() === todayDate.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'long' });
    }

    return getMonthDisplayString(date.getFullYear(), date.getMonth());
  }, [selectedDate, today]);

  const scheduledTodos = useMemo(
    () => getTodosForDate(selectedDate),
    [getTodosForDate, selectedDate, todos]
  );
  const overdueTodos = useMemo(
    () =>
      selectedDate === today
        ? getOverdueTodos(selectedDate).filter((todo) => !!todo.scheduledDate)
        : [],
    [getOverdueTodos, selectedDate, todos, today]
  );
  const openScheduledTodos = scheduledTodos.filter((todo) => todo.status === 'open');
  const completedScheduledTodos = scheduledTodos.filter((todo) => todo.status === 'completed');
  const { rootRef, onRootLayout, dragState, start, move, end, list } = useTaskListDrag({
    items: openScheduledTodos,
    onReorder: reorderTodos,
  });
  const dragHint = useMemo(
    () => (dragHoverDate ? `Drop on ${formatRelativeDateLabel(dragHoverDate)}` : null),
    [dragHoverDate]
  );
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
    await Promise.all([loadTodos(), loadPlan(selectedDate)]);
  }, [loadPlan, loadTodos, selectedDate]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [selectedDate, loadPlan]);

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

  const handleQuickCreate = useCallback(
    async (draft: TodoDraft) => {
      void addTodoOptimistic(draft).catch((error) => {
        console.warn('Failed to create todo:', error);
        Alert.alert('Could not create task', 'Please try again.');
      });
    },
    [addTodoOptimistic]
  );


  const openTaskSheet = useCallback(
    (todo: Todo) => router.push({ pathname: '/task/[id]', params: { id: todo.id } }),
    [router]
  );

  const getCalendarDropDate = useCallback((absoluteX: number, absoluteY: number) => {
    return taskCalendarRef.current?.getDateAtScreenPosition(absoluteX, absoluteY) ?? null;
  }, []);

  const handleTaskDragStart = useCallback(
    (todo: Todo, event: TaskRowDragStartEvent) => {
      const nextHoverDate = getCalendarDropDate(event.absoluteX, event.absoluteY);
      dragHoverDateRef.current = nextHoverDate;
      setDragHoverDate(nextHoverDate);
      start(todo, event);
    },
    [getCalendarDropDate, start]
  );

  const handleTaskDragMove = useCallback(
    (todo: Todo, event: TaskRowDragMoveEvent) => {
      const nextHoverDate = getCalendarDropDate(event.absoluteX, event.absoluteY);
      if (dragHoverDateRef.current !== nextHoverDate) {
        dragHoverDateRef.current = nextHoverDate;
        setDragHoverDate(nextHoverDate);
        if (nextHoverDate) {
          void Haptics.selectionAsync();
        }
      }

      // Exactly one target: over the strip the day highlight wins and the list opens no gap.
      move(todo, event, nextHoverDate !== null);
    },
    [getCalendarDropDate, move]
  );

  const handleTaskDragEnd = useCallback(
    async (todo: Todo, event: TaskRowDragMoveEvent) => {
      const dropDate =
        getCalendarDropDate(event.absoluteX, event.absoluteY) ?? dragHoverDateRef.current;

      dragHoverDateRef.current = null;
      setDragHoverDate(null);
      end(todo, event, dropDate !== null);

      if (!dropDate || dropDate === todo.scheduledDate) {
        return;
      }

      await rescheduleTodo(todo, dropDate);
    },
    [end, getCalendarDropDate, rescheduleTodo]
  );

  const renderTaskRow = useCallback(
    (todo: Todo, isLast: boolean, keyPrefix?: string) => (
      <TaskRow
        key={keyPrefix ? `${keyPrefix}-${todo.id}` : todo.id}
        todo={todo}
        variant="compact"
        isLast={isLast}
        onToggleStatus={handleToggleTodoStatus}
        onRemove={removeTodo}
        onEdit={openTaskSheet}
        onReschedule={setReschedulingTodo}
        onDragStart={handleTaskDragStart}
        onDragMove={handleTaskDragMove}
        onDragEnd={handleTaskDragEnd}
        isDragging={dragState?.todo.id === todo.id}
      />
    ),
    [
      dragState?.todo.id,
      handleTaskDragEnd,
      handleTaskDragMove,
      handleTaskDragStart,
      handleToggleTodoStatus,
      openTaskSheet,
      removeTodo,
    ]
  );

  const renderTaskRows = useCallback(
    (items: Todo[], keyPrefix: string) =>
      items.map((todo, index) => renderTaskRow(todo, index === items.length - 1, keyPrefix)),
    [renderTaskRow]
  );

  return (
    <>
      <Tabs.Screen
        options={{
          title: 'Calendar',
          headerTitle,
        }}
      />

      <View ref={rootRef} onLayout={onRootLayout} style={styles.container}>
        <TaskCalendar
          ref={taskCalendarRef}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          taskDatesWithDots={taskDatesWithDots}
          dragHoverDate={dragHoverDate}
        />

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
          {overdueTodos.length > 0 ? (
            <TaskSectionCard title="Overdue">
              {renderTaskRows(overdueTodos, 'overdue')}
            </TaskSectionCard>
          ) : null}

          <TaskSectionCard title={selectedDateLabel}>
            {openScheduledTodos.length > 0 ? (
              <TaskDragList
                items={openScheduledTodos}
                drag={list}
                renderRow={(todo, index) =>
                  renderTaskRow(todo, index === openScheduledTodos.length - 1)
                }
              />
            ) : (
              <Caption style={styles.emptySection}>
                Nothing scheduled — tap + to add one.
              </Caption>
            )}
          </TaskSectionCard>

          {completedScheduledTodos.length > 0 ? (
            <TaskSectionCard
              title="Completed"
              count={completedScheduledTodos.length}
              collapsible
              defaultExpanded
              dimContent
            >
              {renderTaskRows(completedScheduledTodos, 'completed')}
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
          accessibilityLabel="Add a new task for this day"
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>

        <TaskQuickCreateSheet
          visible={showQuickCreate}
          onClose={() => setShowQuickCreate(false)}
          onSave={handleQuickCreate}
          defaultScheduledDate={selectedDate}
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

        <TaskDragOverlay dragState={dragState} hint={dragHint} />
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
  emptySection: {
    paddingVertical: SPACING.sm,
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
