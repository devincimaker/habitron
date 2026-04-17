import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Goal, Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { TaskCalendar, type TaskCalendarRef } from '../../components/TaskCalendar';
import { TaskQuickCreateSheet } from '../../components/TaskQuickCreateSheet';
import { SectionHeader } from '../../components/SectionHeader';
import {
  TaskRow,
  type TaskRowDragMoveEvent,
  type TaskRowDragStartEvent,
} from '../../components/TaskRow';
import { TodoEditorModal } from '../../components/TodoEditorModal';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { Card } from '../../components/ui';
import {
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
  TAB_BAR,
  TYPOGRAPHY,
  type Colors,
} from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';
import { useUndoableTodoRemoval } from '../../hooks/useUndoableTodoRemoval';
import { useTodoPlanOutcomeSync } from '../../hooks/useTodoPlanOutcomeSync';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { formatRelativeDateLabel, getMonthDisplayString } from '../../utils/dateUtils';
import { getTodoPlanOutcomeForStatus } from '../../utils/todoPlanOutcome';
import { formatTodoScheduledTime } from '../../utils/todoTime';

interface DragState {
  todo: Todo;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
}

export default function CalendarScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const today = getTodayDate();
  const containerRef = useRef<View>(null);
  const taskCalendarRef = useRef<TaskCalendarRef>(null);
  const dragHoverDateRef = useRef<string | null>(null);
  const rootFrameRef = useRef({ x: 0, y: 0 });
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const { selectedDate, setSelectedDate } = useHabitsStore();
  const {
    todos,
    lists,
    isLoading,
    loadTodos,
    addTodo,
    addTodoOptimistic,
    updateTodo,
    setTodoStatusOptimistic,
    getTodosForDate,
    getOverdueTodos,
  } = useTodosStore();
  const { goals, loadGoals } = useGoalsStore();
  const { loadPlan } = useDailyPlansStore();

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showTodoEditor, setShowTodoEditor] = useState(false);
  const { removedTodo, removeTodo, undoRemoveTodo, dismissRemovedTodo } = useUndoableTodoRemoval();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragHoverDate, setDragHoverDate] = useState<string | null>(null);
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
  const dragScheduledTimeLabel = dragState ? formatTodoScheduledTime(dragState.todo.scheduledTime) : null;
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
    void Promise.all([loadTodos(), loadGoals()]);
  }, [loadGoals, loadTodos]);

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [selectedDate, loadPlan]);

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
      try {
        const nextStatus: TodoStatus = todo.status === 'completed' ? 'open' : 'completed';
        const updatedTodo = await setTodoStatusOptimistic(todo.id, nextStatus);

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

  const handleMoveTodo = useCallback(
    async (todo: Todo, nextDate: string) => {
      void Haptics.selectionAsync();
      const previousScheduledDate = todo.scheduledDate;
      await updateTodo(todo.id, { scheduledDate: nextDate });
      await syncTodoPlanOutcome(previousScheduledDate, todo.id, 'deferred');
    },
    [syncTodoPlanOutcome, updateTodo]
  );

  const openTaskEditor = useCallback((todo?: Todo | null) => {
    setEditingTodo(todo ?? null);
    setShowTodoEditor(true);
  }, []);

  const measureRootFrame = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.measureInWindow((x, y) => {
      rootFrameRef.current = { x, y };
    });
  }, []);

  const handleContainerLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      measureRootFrame();
    },
    [measureRootFrame]
  );

  const getCalendarDropDate = useCallback((absoluteX: number, absoluteY: number) => {
    return taskCalendarRef.current?.getDateAtScreenPosition(absoluteX, absoluteY) ?? null;
  }, []);

  const handleTaskDragStart = useCallback(
    (todo: Todo, event: TaskRowDragStartEvent) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const nextHoverDate = getCalendarDropDate(event.absoluteX, event.absoluteY);
      dragHoverDateRef.current = nextHoverDate;
      setDragHoverDate(nextHoverDate);
      setDragState({
        todo,
        width: event.width,
        height: event.height,
        offsetX: event.absoluteX - event.x,
        offsetY: event.absoluteY - event.y,
        left: event.x - rootFrameRef.current.x,
        top: event.y - rootFrameRef.current.y,
      });
    },
    [getCalendarDropDate]
  );

  const handleTaskDragMove = useCallback(
    (_todo: Todo, event: TaskRowDragMoveEvent) => {
      setDragState((current) =>
        current
          ? {
              ...current,
              left: event.absoluteX - current.offsetX - rootFrameRef.current.x,
              top: event.absoluteY - current.offsetY - rootFrameRef.current.y,
            }
          : current
      );

      const nextHoverDate = getCalendarDropDate(event.absoluteX, event.absoluteY);
      if (dragHoverDateRef.current !== nextHoverDate) {
        dragHoverDateRef.current = nextHoverDate;
        setDragHoverDate(nextHoverDate);
        if (nextHoverDate) {
          void Haptics.selectionAsync();
        }
      }
    },
    [getCalendarDropDate]
  );

  const handleTaskDragEnd = useCallback(
    async (todo: Todo, event: TaskRowDragMoveEvent) => {
      const dropDate =
        getCalendarDropDate(event.absoluteX, event.absoluteY) ?? dragHoverDateRef.current;

      dragHoverDateRef.current = null;
      setDragState(null);
      setDragHoverDate(null);

      if (!dropDate || dropDate === todo.scheduledDate) {
        return;
      }

      await handleMoveTodo(todo, dropDate);
    },
    [getCalendarDropDate, handleMoveTodo]
  );

  const renderTaskCard = useCallback(
    (items: Todo[], keyPrefix?: string) => (
      <Card variant="outlined">
        {items.map((todo) => (
          <TaskRow
            key={keyPrefix ? `${keyPrefix}-${todo.id}` : todo.id}
            todo={todo}
            variant="compact"
            onToggleStatus={handleToggleTodoStatus}
            onRemove={removeTodo}
            onEdit={openTaskEditor}
            onDragStart={handleTaskDragStart}
            onDragMove={handleTaskDragMove}
            onDragEnd={handleTaskDragEnd}
            isDragging={dragState?.todo.id === todo.id}
          />
        ))}
      </Card>
    ),
    [
      dragState?.todo.id,
      handleTaskDragEnd,
      handleTaskDragMove,
      handleTaskDragStart,
      handleToggleTodoStatus,
      openTaskEditor,
      removeTodo,
    ]
  );

  return (
    <>
      <Tabs.Screen
        options={{
          title: 'Calendar',
          headerTitle,
        }}
      />

      <View ref={containerRef} onLayout={handleContainerLayout} style={styles.container}>
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
            <>
              <SectionHeader
                title="Overdue"
                subtitle="Scheduled earlier and still open"
              />
              {renderTaskCard(overdueTodos, 'overdue')}
            </>
          ) : null}

          <SectionHeader
            title="Tasks"
            subtitle={
              selectedDate === today
                ? 'Scheduled for today'
                : `Scheduled for ${formatRelativeDateLabel(selectedDate)}`
            }
          />

          {openScheduledTodos.length > 0 ? (
            renderTaskCard(openScheduledTodos)
          ) : null}

          {completedScheduledTodos.length > 0 ? (
            <>
              <SectionHeader
                title="Completed"
                subtitle="Things already closed out for this day"
              />
              {renderTaskCard(completedScheduledTodos, 'completed')}
            </>
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

        <TodoEditorModal
          visible={showTodoEditor}
          todo={editingTodo}
          defaultScheduledDate={editingTodo ? undefined : selectedDate}
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

        {dragState ? (
          <View pointerEvents="none" style={styles.dragLayer}>
            <View
              style={[
                styles.dragCard,
                {
                  left: dragState.left,
                  top: dragState.top,
                  width: Math.max(Math.min(dragState.width, 360), 220),
                },
              ]}
            >
              <Text style={styles.dragTitle}>{dragState.todo.title}</Text>
              <View style={styles.dragMeta}>
                {dragScheduledTimeLabel ? (
                  <Text style={styles.dragMetaText}>{dragScheduledTimeLabel}</Text>
                ) : null}
                {dragState.todo.dueDate ? (
                  <Text style={styles.dragMetaText}>
                    Due {formatRelativeDateLabel(dragState.todo.dueDate)}
                  </Text>
                ) : null}
                {dragHoverDate ? (
                  <Text style={styles.dragTargetText}>
                    Drop on {formatRelativeDateLabel(dragHoverDate)}
                  </Text>
                ) : (
                  <Text style={styles.dragMetaText}>Drag onto a visible day</Text>
                )}
              </View>
            </View>
          </View>
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
  dragLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  dragCard: {
    position: 'absolute',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    opacity: 0.96,
  },
  dragTitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: colors.text,
    fontWeight: '600',
  },
  dragMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 4,
  },
  dragMetaText: {
    ...TYPOGRAPHY.caption,
    color: colors.textSecondary,
  },
  dragTargetText: {
    ...TYPOGRAPHY.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
