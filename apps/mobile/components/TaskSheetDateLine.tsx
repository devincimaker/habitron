import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Todo } from '@habits-coach/shared';
import { formatDateString, formatSheetDate, getTaskDateBadge } from '../utils/dateUtils';
import { formatTodoScheduledTime } from '../utils/todoTime';
import { getTodoPriorityOption } from '../utils/todoPriority';
import { FONT_SIZES, SPACING, TASK_SCHEDULED, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface TaskSheetDateLineProps {
  todo: Todo;
  onToggleStatus: () => void;
  onPressDate: () => void;
  onPressTime: () => void;
}

/**
 * The line under the sheet's header: complete the task on the left, and the
 * schedule on the right as two separate targets — the date opens the shortcut
 * menu, the time its own picker.
 */
export function TaskSheetDateLine({
  todo,
  onToggleStatus,
  onPressDate,
  onPressTime,
}: TaskSheetDateLineProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  const isCompleted = todo.status === 'completed';
  const checkboxColor = isCompleted
    ? colors.success
    : (getTodoPriorityOption(todo.priority)?.color ?? colors.textLight);

  const time = formatTodoScheduledTime(todo.scheduledTime);
  // The row's rule: done first, then overdue, then scheduled.
  const isOverdue =
    todo.scheduledDate !== undefined && getTaskDateBadge(todo.scheduledDate).tone === 'overdue';
  const dateColor = isCompleted
    ? colors.textLight
    : isOverdue
      ? colors.error
      : TASK_SCHEDULED;

  return (
    <View style={styles.block}>
      <View style={styles.line}>
        <Pressable
          onPress={onToggleStatus}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
          accessibilityLabel={isCompleted ? 'Mark task open' : 'Mark task done'}
          hitSlop={8}
        >
          <Ionicons
            name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={checkboxColor}
          />
        </Pressable>

        {todo.scheduledDate ? (
          <View style={styles.schedule}>
            <Pressable
              onPress={onPressDate}
              accessibilityRole="button"
              accessibilityLabel={`Scheduled ${formatDateString(todo.scheduledDate)}. Change the date`}
              hitSlop={8}
            >
              <Text style={[styles.date, { color: dateColor }]}>
                {formatSheetDate(todo.scheduledDate)}
              </Text>
            </Pressable>

            <Pressable
              onPress={onPressTime}
              accessibilityRole="button"
              accessibilityLabel={time ? `Scheduled at ${time}. Change the time` : 'Add a time'}
              hitSlop={8}
            >
              {time ? (
                <Text style={[styles.date, { color: dateColor }]}>{` · ${time}`}</Text>
              ) : (
                <Text style={[styles.date, styles.muted]}>{'  + time'}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onPressDate}
            accessibilityRole="button"
            accessibilityLabel="Add a date"
            hitSlop={8}
          >
            <Text style={[styles.date, styles.muted]}>Add a date</Text>
          </Pressable>
        )}
      </View>

      {todo.dueDate ? (
        <Text style={styles.due}>{`Due ${formatSheetDate(todo.dueDate)}`}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    block: {
      gap: 2,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.sm + 4,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm + 4,
      minHeight: 32,
    },
    date: {
      fontSize: FONT_SIZES.sm + 1,
      lineHeight: 20,
      fontWeight: '500',
    },
    schedule: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    muted: {
      color: colors.textLight,
    },
    due: {
      fontSize: FONT_SIZES.footnote,
      lineHeight: 18,
      color: colors.textLight,
      // Clears the checkbox and the gap beside it, so it hangs under the date.
      paddingLeft: 24 + SPACING.sm + 4,
    },
  });
