import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Todo } from '@habits-coach/shared';
import { BodyMedium, Caption } from './ui';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { formatRelativeDateLabel, getNextDay } from '../utils/dateUtils';
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
  selectedDate: string;
  onToggleStatus: (todo: Todo) => Promise<void>;
  onMoveTomorrow: (todo: Todo, nextDate: string) => Promise<void>;
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
  selectedDate,
  onToggleStatus,
  onMoveTomorrow,
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
  const nextDay = getNextDay(selectedDate);
  const nextDayLabel = formatRelativeDateLabel(nextDay);

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
      <View ref={rowRef} style={[styles.taskRow, isDragging && styles.draggingRow]}>
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
              style={todo.status === 'completed' ? styles.completedText : undefined}
            >
              {todo.title}
            </BodyMedium>
            <View style={styles.taskMeta}>
              {todo.scheduledBlock ? <Caption>{todo.scheduledBlock}</Caption> : null}
              {todo.dueDate ? (
                <Caption>Due {formatRelativeDateLabel(todo.dueDate)}</Caption>
              ) : null}
              {todo.tags.length > 0 ? (
                <Caption>{todo.tags.map((tag) => `#${tag.name}`).join(' ')}</Caption>
              ) : null}
            </View>
          </Pressable>
        </View>

        <View style={styles.taskActions}>
          {todo.status === 'open' ? (
            <>
              <Pressable
                style={styles.taskActionChip}
                onPress={() => void onMoveTomorrow(todo, nextDay)}
              >
                <Ionicons
                  name="arrow-forward"
                  size={12}
                  color={colors.textSecondary}
                />
                <Caption color={colors.textSecondary}>Move to {nextDayLabel}</Caption>
              </Pressable>
              <Pressable style={styles.taskActionChip} onPress={() => void onCancel(todo)}>
                <Ionicons name="close" size={12} color={colors.error} />
                <Caption color={colors.error}>Cancel</Caption>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.taskActionChip} onPress={() => onEdit(todo)}>
              <Caption color={colors.textSecondary}>Edit</Caption>
            </Pressable>
          )}
          <Pressable style={styles.taskActionChip} onPress={() => onDelete(todo)}>
            <Ionicons name="trash-outline" size={14} color={colors.textLight} />
          </Pressable>
        </View>
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
