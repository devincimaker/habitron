import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Todo } from '@habits-coach/shared';
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
  onPressTag: () => void;
  onPressEstimate: () => void;
}

/**
 * What the task *is*, as chips: its category and its estimate. Each one shows
 * only when set — the bottom bar is where an unset one is added.
 */
export function TaskSheetChips({ todo, onPressTag, onPressEstimate }: TaskSheetChipsProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  const { estimateMinutes, actualMinutes } = todo;
  if (!todo.tag && estimateMinutes === undefined) return null;

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
  });
