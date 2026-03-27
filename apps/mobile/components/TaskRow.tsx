import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Todo } from '@habits-coach/shared';
import { BodyMedium, Caption } from './ui';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { formatRelativeDateLabel, getNextDay } from '../utils/dateUtils';

interface TaskRowProps {
  todo: Todo;
  selectedDate: string;
  onToggleStatus: (todo: Todo) => Promise<void>;
  onMoveTomorrow: (todo: Todo, nextDate: string) => Promise<void>;
  onCancel: (todo: Todo) => Promise<void>;
  onDelete: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
}

export function TaskRow({
  todo,
  selectedDate,
  onToggleStatus,
  onMoveTomorrow,
  onCancel,
  onDelete,
  onEdit,
}: TaskRowProps) {
  const nextDay = getNextDay(selectedDate);

  return (
    <View style={styles.taskRow}>
      <View style={styles.taskMain}>
        <Pressable style={styles.taskStatusButton} onPress={() => void onToggleStatus(todo)}>
          <Ionicons
            name={todo.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={todo.status === 'completed' ? COLORS.success : COLORS.textLight}
          />
        </Pressable>

        <Pressable style={styles.taskCopy} onPress={() => onEdit(todo)}>
          <BodyMedium
            color={COLORS.text}
            style={todo.status === 'completed' ? styles.completedText : undefined}
          >
            {todo.title}
          </BodyMedium>
          <View style={styles.taskMeta}>
            {todo.scheduledBlock ? (
              <Caption>{todo.scheduledBlock}</Caption>
            ) : null}
            {todo.dueDate ? <Caption>Due {formatRelativeDateLabel(todo.dueDate)}</Caption> : null}
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
              <Caption color={COLORS.textSecondary}>Tomorrow</Caption>
            </Pressable>
            <Pressable style={styles.taskActionChip} onPress={() => void onCancel(todo)}>
              <Caption color={COLORS.error}>Cancel</Caption>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.taskActionChip} onPress={() => onEdit(todo)}>
            <Caption color={COLORS.textSecondary}>Edit</Caption>
          </Pressable>
        )}
        <Pressable style={styles.taskActionChip} onPress={() => onDelete(todo)}>
          <Ionicons name="trash-outline" size={14} color={COLORS.textLight} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  taskRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    color: COLORS.textLight,
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
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
});
