import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { Goal } from '@habits-coach/shared';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { describeGoalMeta, isGoalOpen, type GoalTaskCounts } from '../utils/goals';

interface GoalCardProps {
  goal: Goal;
  tasks: GoalTaskCounts;
  today: string;
  onPress: () => void;
}

/** One goal on the list: what, how you'll know, and how far along it is. */
export function GoalCard({ goal, tasks, today, onPress }: GoalCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const open = isGoalOpen(goal);

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={goal.title}
    >
      <View style={[styles.icon, !open && styles.iconDone]}>
        {open ? (
          <Feather name="target" size={18} color={colors.primary} />
        ) : (
          <Ionicons name="checkmark" size={20} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, !open && styles.titleDone]} numberOfLines={2}>
          {goal.title}
        </Text>
        <Text style={styles.measure} numberOfLines={2}>
          {goal.measure}
        </Text>
        <Text style={styles.meta}>{describeGoalMeta(goal, tasks, today)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm + 4,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md + 4,
      backgroundColor: colors.surface,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    iconDone: {
      backgroundColor: colors.controlFill,
    },
    body: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textStrong,
    },
    titleDone: {
      color: colors.textSecondary,
    },
    measure: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    meta: {
      fontSize: 12,
      color: colors.textLight,
      marginTop: 2,
    },
  });
