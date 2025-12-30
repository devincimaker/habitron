import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HabitAction } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface SuggestionCardProps {
  action: HabitAction;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function SuggestionCard({ action, onConfirm, onDismiss }: SuggestionCardProps) {
  const getActionTitle = () => {
    switch (action.type) {
      case 'add':
        return 'Suggested Habit';
      case 'remove':
        return 'Remove Habit';
      case 'edit':
        return 'Update Habit';
    }
  };

  const getConfirmText = () => {
    switch (action.type) {
      case 'add':
        return `Start ${action.habit.name}`;
      case 'remove':
        return `Remove ${action.habit.name}`;
      case 'edit':
        return `Update ${action.habit.name}`;
    }
  };

  const getActionColor = () => {
    switch (action.type) {
      case 'add':
        return COLORS.success;
      case 'remove':
        return COLORS.error;
      case 'edit':
        return COLORS.primary;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getActionTitle()}</Text>

      <View style={styles.habitInfo}>
        <Text style={styles.habitName}>{action.habit.name}</Text>
        <View style={styles.details}>
          <Text style={styles.detail}>
            {action.habit.frequency === 'daily' ? 'Every day' : 'Weekly'}
          </Text>
          {action.habit.timeOfDay && action.habit.timeOfDay !== 'anytime' && (
            <>
              <Text style={styles.detailSeparator}>•</Text>
              <Text style={styles.detail}>{action.habit.timeOfDay}</Text>
            </>
          )}
        </View>
        {action.habit.reason && (
          <Text style={styles.reason}>{action.habit.reason}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: getActionColor() }]}
          onPress={onConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>{getConfirmText()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.medium,
  },
  title: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  habitInfo: {
    marginBottom: SPACING.md,
  },
  habitName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  detail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  detailSeparator: {
    marginHorizontal: SPACING.xs,
    color: COLORS.textLight,
  },
  reason: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  dismissButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  dismissText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  confirmButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  confirmText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
