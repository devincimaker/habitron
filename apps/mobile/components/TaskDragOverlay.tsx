import { StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import type { TaskDragState } from '../hooks/useTaskListDrag';
import { formatRelativeDateLabel } from '../utils/dateUtils';
import { formatTodoScheduledTime } from '../utils/todoTime';

interface TaskDragOverlayProps {
  dragState: TaskDragState | null;
  /** Names the target under the pointer when it is not the list itself. */
  hint?: string | null;
}

/** The clone that follows the finger while a TaskRow is being dragged. */
export function TaskDragOverlay({ dragState, hint }: TaskDragOverlayProps) {
  const [styles] = useThemedStyles(createStyles);

  if (!dragState) return null;

  const scheduledTimeLabel = formatTodoScheduledTime(dragState.todo.scheduledTime);

  return (
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
          {scheduledTimeLabel ? <Text style={styles.dragMetaText}>{scheduledTimeLabel}</Text> : null}
          {dragState.todo.dueDate ? (
            <Text style={styles.dragMetaText}>
              Due {formatRelativeDateLabel(dragState.todo.dueDate)}
            </Text>
          ) : null}
          {hint ? <Text style={styles.dragTargetText}>{hint}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
