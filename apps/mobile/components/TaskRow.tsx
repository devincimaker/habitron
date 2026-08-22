import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Todo } from '@habits-coach/shared';
import { BodyMedium, Caption } from './ui';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { formatRelativeDateLabel, getTaskDateBadge } from '../utils/dateUtils';
import {
  decrementDuration,
  formatDurationMinutes,
  getEstimateDelta,
  incrementDuration,
} from '../utils/todoEstimate';
import { getTodoTagTintColor } from '../utils/todoTagColors';
import { formatTodoScheduledTime } from '../utils/todoTime';
import { useThemedStyles } from '../hooks/useColors';

export interface TaskStatusToggleOptions {
  actualMinutes?: number;
}

export interface TaskRowDragStartEvent {
  absoluteX: number;
  absoluteY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TaskRowDragMoveEvent {
  absoluteX: number;
  absoluteY: number;
}

interface TaskRowProps {
  todo: Todo;
  variant?: 'default' | 'compact';
  onToggleStatus: (todo: Todo, options?: TaskStatusToggleOptions) => Promise<void>;
  onRemove: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDragStart?: (todo: Todo, event: TaskRowDragStartEvent) => void;
  onDragMove?: (todo: Todo, event: TaskRowDragMoveEvent) => void;
  onDragEnd?: (todo: Todo, event: TaskRowDragMoveEvent) => void;
  isDragging?: boolean;
}

const REMOVE_ACTION_WIDTH = 84;

export function TaskRow({
  todo,
  variant = 'default',
  onToggleStatus,
  onRemove,
  onEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDragging = false,
}: TaskRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const rowRef = useRef<View>(null);
  const swipeableRef = useRef<Swipeable>(null);
  const [askingActualMinutes, setAskingActualMinutes] = useState<number | null>(null);
  const isAsking = askingActualMinutes !== null;
  const isCompleted = todo.status === 'completed';
  const estimateLabel = todo.estimateMinutes ? formatDurationMinutes(todo.estimateMinutes) : null;
  const completedDelta =
    isCompleted && todo.estimateMinutes && todo.actualMinutes
      ? getEstimateDelta(todo.estimateMinutes, todo.actualMinutes)
      : null;
  const liveDelta =
    isAsking && todo.estimateMinutes
      ? getEstimateDelta(todo.estimateMinutes, askingActualMinutes)
      : null;
  const deltaColor = (tone: 'over' | 'under' | 'exact') =>
    tone === 'over' ? colors.error : tone === 'under' ? colors.success : colors.textSecondary;
  const displayDate = todo.scheduledDate ?? todo.dueDate;
  const dateBadge = displayDate ? getTaskDateBadge(displayDate) : null;
  const scheduledTimeLabel = formatTodoScheduledTime(todo.scheduledTime);
  const compactScheduleLabel =
    dateBadge && scheduledTimeLabel
      ? `${dateBadge.label} ${scheduledTimeLabel}`
      : dateBadge?.label ?? scheduledTimeLabel;
  const isCompact = variant === 'compact';
  const shouldShowCompactSchedule = isCompact && !!compactScheduleLabel;
  const compactScheduleColor =
    todo.status === 'completed'
      ? colors.textLight
      : dateBadge?.tone === 'overdue'
        ? colors.error
        : '#2F80ED';

  const handleDragStart = useCallback(
    (absoluteX: number, absoluteY: number) => {
      if (!onDragStart || !rowRef.current) return;

      rowRef.current.measureInWindow((x, y, width, height) => {
        onDragStart(todo, {
          absoluteX,
          absoluteY,
          x,
          y,
          width,
          height,
        });
      });
    },
    [onDragStart, todo]
  );

  const handleDragMove = useCallback(
    (absoluteX: number, absoluteY: number) => {
      onDragMove?.(todo, { absoluteX, absoluteY });
    },
    [onDragMove, todo]
  );

  const handleDragEnd = useCallback(
    (absoluteX: number, absoluteY: number) => {
      onDragEnd?.(todo, { absoluteX, absoluteY });
    },
    [onDragEnd, todo]
  );

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(todo.status === 'open' && !!onDragStart && !!onDragMove && !!onDragEnd)
        .activateAfterLongPress(220)
        .onStart((event) => {
          runOnJS(handleDragStart)(event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          runOnJS(handleDragMove)(event.absoluteX, event.absoluteY);
        })
        .onEnd((event) => {
          runOnJS(handleDragEnd)(event.absoluteX, event.absoluteY);
        }),
    [handleDragEnd, handleDragMove, handleDragStart, onDragEnd, onDragMove, onDragStart, todo.status]
  );

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handleTogglePress = useCallback(() => {
    closeSwipeable();
    if (todo.status === 'open' && todo.estimateMinutes) {
      // The row becomes the question: how long did it actually take?
      setAskingActualMinutes(todo.estimateMinutes);
      return;
    }
    void onToggleStatus(todo);
  }, [closeSwipeable, onToggleStatus, todo]);

  const handleCancelAsk = useCallback(() => {
    setAskingActualMinutes(null);
  }, []);

  const handleConfirmActual = useCallback(() => {
    if (askingActualMinutes === null) return;
    setAskingActualMinutes(null);
    void onToggleStatus(todo, { actualMinutes: askingActualMinutes });
  }, [askingActualMinutes, onToggleStatus, todo]);

  const handleEditPress = useCallback(() => {
    closeSwipeable();
    onEdit(todo);
  }, [closeSwipeable, onEdit, todo]);

  const handleRemovePress = useCallback(() => {
    closeSwipeable();
    onRemove(todo);
  }, [closeSwipeable, onRemove, todo]);

  const renderRightActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>) => {
      const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [REMOVE_ACTION_WIDTH * 0.35, 0],
        extrapolate: 'clamp',
      });
      const opacity = progress.interpolate({
        inputRange: [0, 0.15, 0.65, 1],
        outputRange: [0.18, 0.3, 0.85, 1],
        extrapolate: 'clamp',
      });
      const scale = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.removeActionContainer}>
          <Animated.View
            style={[
              styles.removeActionButton,
              {
                opacity,
                transform: [{ translateX }, { scale }],
              },
            ]}
          >
            <Pressable
              style={styles.removeActionPressable}
              onPress={handleRemovePress}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${todo.title}`}
            >
              <Ionicons name="trash-outline" size={20} color={colors.white} />
            </Pressable>
          </Animated.View>
        </View>
      );
    },
    [colors.white, handleRemovePress, styles.removeActionButton, styles.removeActionContainer, styles.removeActionPressable, todo.title]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      friction={1.4}
      overshootRight={false}
      rightThreshold={REMOVE_ACTION_WIDTH * 0.55}
      renderRightActions={renderRightActions}
    >
      <GestureDetector gesture={dragGesture}>
        <View
          ref={rowRef}
          style={[
            styles.taskRow,
            isCompact && styles.compactTaskRow,
            isDragging && styles.draggingRow,
          ]}
        >
          {isAsking ? (
            <View>
              <View style={styles.askHeader}>
                <BodyMedium color={colors.text} style={styles.completedText}>
                  {todo.title}
                </BodyMedium>
                <Pressable
                  onPress={handleCancelAsk}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel completing task"
                  hitSlop={8}
                >
                  <Caption color={colors.textLight}>Cancel</Caption>
                </Pressable>
              </View>
              <View style={styles.askControls}>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => setAskingActualMinutes(decrementDuration(askingActualMinutes))}
                  accessibilityRole="button"
                  accessibilityLabel="Less time"
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </Pressable>
                <View style={styles.askValue}>
                  <BodyMedium color={colors.text} style={styles.askValueText}>
                    {formatDurationMinutes(askingActualMinutes)}
                  </BodyMedium>
                  {liveDelta ? (
                    <Caption color={deltaColor(liveDelta.tone)}>
                      {liveDelta.tone === 'exact'
                        ? 'Exactly your estimate'
                        : `${formatDurationMinutes(Math.abs(liveDelta.minutes))} ${liveDelta.tone} your estimate`}
                    </Caption>
                  ) : null}
                </View>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => setAskingActualMinutes(incrementDuration(askingActualMinutes))}
                  accessibilityRole="button"
                  accessibilityLabel="More time"
                >
                  <Ionicons name="add" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  style={styles.doneButton}
                  onPress={handleConfirmActual}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark done, took ${formatDurationMinutes(askingActualMinutes)}`}
                >
                  <BodyMedium color={colors.white} style={styles.doneButtonText}>
                    Done
                  </BodyMedium>
                </Pressable>
              </View>
            </View>
          ) : (
          <View style={styles.taskMain}>
            <Pressable style={styles.taskStatusButton} onPress={handleTogglePress}>
              <Ionicons
                name={todo.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={todo.status === 'completed' ? colors.success : colors.textLight}
              />
            </Pressable>

            <Pressable style={styles.taskCopy} onPress={handleEditPress}>
              <BodyMedium
                color={colors.text}
                style={StyleSheet.flatten([
                  isCompact ? styles.compactTitle : undefined,
                  todo.status === 'completed' ? styles.completedText : undefined,
                ])}
              >
                {todo.title}
              </BodyMedium>
              <View style={[styles.taskMeta, isCompact && styles.compactTaskMeta]}>
                {isCompact
                  ? todo.tags.slice(0, 2).map((tag) => (
                      <View
                        key={tag.id}
                        style={[
                          styles.tagPill,
                          tag.color
                            ? {
                                backgroundColor: getTodoTagTintColor(tag.color, '1F'),
                                borderColor: getTodoTagTintColor(tag.color, '3D'),
                              }
                            : undefined,
                        ]}
                      >
                        <Caption color={tag.color ?? colors.textSecondary}>{tag.name}</Caption>
                      </View>
                    ))
                  : todo.tags.length > 0 ? (
                      <Caption>{todo.tags.map((tag) => `#${tag.name}`).join(' ')}</Caption>
                    ) : null}
                {shouldShowCompactSchedule ? (
                  <Caption
                    color={compactScheduleColor}
                    style={styles.compactSchedule}
                  >
                    {compactScheduleLabel}
                  </Caption>
                ) : null}
                {!isCompact && scheduledTimeLabel ? <Caption>{scheduledTimeLabel}</Caption> : null}
                {!isCompact && todo.dueDate ? (
                  <Caption>Due {formatRelativeDateLabel(todo.dueDate)}</Caption>
                ) : null}
                {estimateLabel ? (
                  <View style={styles.estimate}>
                    <Ionicons name="time-outline" size={12} color={colors.textLight} />
                    <Caption color={colors.textLight}>{estimateLabel}</Caption>
                  </View>
                ) : null}
                {completedDelta ? (
                  <View
                    style={[
                      styles.deltaPill,
                      completedDelta.tone === 'exact'
                        ? styles.deltaPillExact
                        : { backgroundColor: `${deltaColor(completedDelta.tone)}14` },
                    ]}
                  >
                    <Caption color={deltaColor(completedDelta.tone)} style={styles.deltaText}>
                      {completedDelta.label}
                    </Caption>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>
          )}
        </View>
      </GestureDetector>
    </Swipeable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  taskRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compactTaskRow: {
    paddingVertical: 10,
  },
  draggingRow: {
    opacity: 0.2,
  },
  taskMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskStatusButton: {
    marginRight: SPACING.sm,
    marginTop: 1,
  },
  taskCopy: {
    flex: 1,
  },
  compactTitle: {
    lineHeight: 20,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.textLight,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 2,
  },
  compactTaskMeta: {
    gap: 6,
    marginTop: 4,
  },
  compactSchedule: {
    fontWeight: '600',
    textTransform: 'none',
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deltaPill: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deltaPillExact: {
    backgroundColor: colors.surface,
  },
  deltaText: {
    fontWeight: '600',
  },
  askHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  askControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: SPACING.sm,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askValue: {
    flex: 1,
    alignItems: 'center',
  },
  askValueText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },
  doneButton: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontWeight: '600',
  },
  tagPill: {
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  removeActionContainer: {
    width: REMOVE_ACTION_WIDTH,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  removeActionButton: {
    flex: 1,
    backgroundColor: colors.error,
  },
  removeActionPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
