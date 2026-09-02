import { Pressable, StyleSheet, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { Goal, Todo, TodoList } from '@habits-coach/shared';
import { TodoTagPill } from './TodoTagPill';
import { Caption } from './ui';
import {
  formatDurationMinutes,
  getEstimateDelta,
  getEstimateDeltaColor,
} from '../utils/todoEstimate';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface TaskSheetChipsProps {
  todo: Todo;
  /** The task's list; the chip shows only for a list that is not the Inbox. */
  list?: TodoList;
  /** The goal the task serves, when it serves one and the module is on. */
  goal?: Goal;
  onPressTag: () => void;
  onPressGoal?: () => void;
  onPressList: () => void;
  onPressEstimate: () => void;
}

/**
 * What the task *is*, as chips: its list, its category and its estimate. Each
 * one shows only when set — the bottom bar is where an unset one is added, and
 * the Inbox is the unset list.
 */
export function TaskSheetChips({
  todo,
  list,
  goal,
  onPressTag,
  onPressGoal,
  onPressList,
  onPressEstimate,
}: TaskSheetChipsProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  const shownList = list && !list.isInbox ? list : undefined;
  const { estimateMinutes, actualMinutes } = todo;
  if (!todo.tag && !shownList && !goal && estimateMinutes === undefined) return null;

  // A finished task reads its actual against the estimate, in the row's colours.
  const delta =
    todo.status === 'completed' && estimateMinutes !== undefined && actualMinutes !== undefined
      ? {
          label: `${formatDurationMinutes(actualMinutes)} of ${formatDurationMinutes(estimateMinutes)}`,
          color: getEstimateDeltaColor(
            getEstimateDelta(estimateMinutes, actualMinutes).tone,
            colors
          ),
        }
      : null;

  return (
    <View style={styles.row}>
      {shownList ? (
        <Pressable
          style={styles.listChip}
          onPress={onPressList}
          accessibilityRole="button"
          accessibilityLabel={`List ${shownList.name}. Change it`}
        >
          <View style={[styles.listDot, { backgroundColor: shownList.color ?? colors.textLight }]} />
          <Caption color={colors.textSecondary}>{shownList.name}</Caption>
        </Pressable>
      ) : null}

      {goal ? (
        <Pressable
          style={styles.listChip}
          onPress={onPressGoal}
          accessibilityRole="button"
          accessibilityLabel={`Goal ${goal.title}. Change it`}
        >
          <Feather name="target" size={12} color={colors.primary} />
          <Caption color={colors.textSecondary} numberOfLines={1}>
            {goal.title}
          </Caption>
        </Pressable>
      ) : null}

      {todo.tag ? (
        <TodoTagPill name={todo.tag.name} color={todo.tag.color} onPress={onPressTag} />
      ) : null}

      {estimateMinutes !== undefined ? (
        <Pressable
          style={styles.estimate}
          onPress={onPressEstimate}
          accessibilityRole="button"
          accessibilityLabel={`Estimate ${formatDurationMinutes(estimateMinutes)}. Change it`}
        >
          <Ionicons name="time-outline" size={12} color={colors.textLight} />
          <Caption color={delta?.color ?? colors.textSecondary}>
            {delta?.label ?? formatDurationMinutes(estimateMinutes)}
          </Caption>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    estimate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    listChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    listDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
