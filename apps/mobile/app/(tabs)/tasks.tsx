import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import {
  Alert,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Goal, Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { TaskCalendar, type TaskCalendarRef } from '../../components/TaskCalendar';
import { SectionHeader } from '../../components/SectionHeader';
import {
  TaskRow,
  type TaskRowDragMoveEvent,
  type TaskRowDragStartEvent,
} from '../../components/TaskRow';
import { TodoEditorModal } from '../../components/TodoEditorModal';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { BodyMedium, Card } from '../../components/ui';
import { useDailyPlansStore } from '../../stores/useDailyPlansStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../../constants/theme';
import { getMonthDisplayString } from '../../utils/dateUtils';
import { formatRelativeDateLabel } from '../../utils/dateUtils';
import { useThemedStyles } from '../../hooks/useColors';

interface DragState {
  todo: Todo;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
}

export default function TasksScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const today = getTodayDate();
  const containerRef = useRef<View>(null);
  const taskCalendarRef = useRef<TaskCalendarRef>(null);
  const dragHoverDateRef = useRef<string | null>(null);
  const rootFrameRef = useRef({ x: 0, y: 0 });
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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragHoverDate, setDragHoverDate] = useState<string | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const headerTitle = useMemo(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');

    if (date.getFullYear() === todayDate.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'long' });
    }

    return getMonthDisplayString(date.getFullYear(), date.getMonth());
  }, [selectedDate, today]);

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

  return (
    <>
      <Tabs.Screen
        options={{
          headerTitle: headerTitle,
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
                  onDragStart={handleTaskDragStart}
                  onDragMove={handleTaskDragMove}
                  onDragEnd={handleTaskDragEnd}
                  isDragging={dragState?.todo.id === todo.id}
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
                  onDragStart={handleTaskDragStart}
                  onDragMove={handleTaskDragMove}
                  onDragEnd={handleTaskDragEnd}
                  isDragging={dragState?.todo.id === todo.id}
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
                    onDragStart={handleTaskDragStart}
                    onDragMove={handleTaskDragMove}
                    onDragEnd={handleTaskDragEnd}
                    isDragging={dragState?.todo.id === todo.id}
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
                  onDragStart={handleTaskDragStart}
                  onDragMove={handleTaskDragMove}
                  onDragEnd={handleTaskDragEnd}
                  isDragging={dragState?.todo.id === todo.id}
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
                {dragState.todo.scheduledBlock ? (
                  <Text style={styles.dragMetaText}>{dragState.todo.scheduledBlock}</Text>
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
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.sm,
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
