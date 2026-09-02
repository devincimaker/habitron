import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TodoList } from '@habits-coach/shared';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface TaskListRowProps {
  list: TodoList;
  /** Open tasks in the list. */
  count: number;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function TaskListRow({ list, count, isSelected, onPress, onLongPress }: TaskListRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        isSelected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`List ${list.name}`}
    >
      {list.isInbox ? (
        <Ionicons name="file-tray-outline" size={18} color={colors.textSecondary} style={styles.icon} />
      ) : (
        <View style={[styles.dot, { backgroundColor: list.color ?? colors.textLight }]} />
      )}
      <Text style={styles.name} numberOfLines={1}>
        {list.name}
      </Text>
      {count > 0 ? <Text style={styles.count}>{count}</Text> : null}
    </Pressable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  rowSelected: {
    backgroundColor: colors.controlFill,
  },
  rowPressed: {
    opacity: 0.7,
  },
  icon: {
    width: 18,
    marginRight: SPACING.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 3,
    marginRight: SPACING.md + 3,
  },
  name: {
    ...TYPOGRAPHY.label,
    color: colors.text,
    flex: 1,
  },
  count: {
    ...TYPOGRAPHY.bodyMedium,
    color: colors.textSecondary,
    marginLeft: SPACING.sm,
  },
});
