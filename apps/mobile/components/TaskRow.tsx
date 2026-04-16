import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Todo } from '@habits-coach/shared';
import { BodyMedium, Caption } from './ui';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { formatRelativeDateLabel, getTaskDateBadge } from '../utils/dateUtils';
import { getTodoTagTintColor } from '../utils/todoTagColors';
import { formatTodoScheduledTime } from '../utils/todoTime';
import { useThemedStyles } from '../hooks/useColors';

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
  showCompactActions?: boolean;
  onToggleStatus: (todo: Todo) => Promise<void>;
  onCancel: (todo: Todo) => Promise<void>;
  onDelete: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDragStart?: (todo: Todo, event: TaskRowDragStartEvent) => void;
  onDragMove?: (todo: Todo, event: TaskRowDragMoveEvent) => void;
  onDragEnd?: (todo: Todo, event: TaskRowDragMoveEvent) => void;
  isDragging?: boolean;
}

export function TaskRow({
  todo,
  variant = 'default',
  showCompactActions = true,
  onToggleStatus,
  onCancel,
  onDelete,
  onEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDragging = false,
}: TaskRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const rowRef = useRef<View>(null);
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

  return (
    <GestureDetector gesture={dragGesture}>
      <View
        ref={rowRef}
        style={[
          styles.taskRow,
          isCompact && styles.compactTaskRow,
          isDragging && styles.draggingRow,
        ]}
      >
        <View style={styles.taskMain}>
          <Pressable style={styles.taskStatusButton} onPress={() => void onToggleStatus(todo)}>
            <Ionicons
              name={todo.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={todo.status === 'completed' ? colors.success : colors.textLight}
            />
          </Pressable>

          <Pressable style={styles.taskCopy} onPress={() => onEdit(todo)}>
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
            </View>
          </Pressable>

          {isCompact && showCompactActions ? (
            <View style={styles.compactActions}>
              {todo.status === 'open' ? (
                <Pressable
                  style={styles.compactActionButton}
                  onPress={() => void onCancel(todo)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={colors.error} />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.compactActionButton}
                onPress={() => onDelete(todo)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textLight} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {!isCompact ? (
          <View style={styles.taskActions}>
            {todo.status === 'open' ? (
              <Pressable style={styles.taskActionChip} onPress={() => void onCancel(todo)}>
                <Ionicons name="close" size={12} color={colors.error} />
                <Caption color={colors.error}>Cancel</Caption>
              </Pressable>
            ) : (
              <Pressable style={styles.taskActionChip} onPress={() => onEdit(todo)}>
                <Caption color={colors.textSecondary}>Edit</Caption>
              </Pressable>
            )}
            <Pressable style={styles.taskActionChip} onPress={() => onDelete(todo)}>
              <Ionicons name="trash-outline" size={14} color={colors.textLight} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </GestureDetector>
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
  tagPill: {
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginLeft: SPACING.sm,
    paddingTop: 2,
  },
  compactActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginLeft: 32,
  },
  taskActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
