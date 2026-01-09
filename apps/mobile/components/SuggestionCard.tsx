import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HabitAction } from '@habits-coach/shared';
import { Button, HeadingLarge, BodyMedium, Caption } from './ui';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, LIST_ITEM } from '../constants/theme';

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

  const getButtonVariant = (): 'primary' | 'destructive' => {
    switch (action.type) {
      case 'remove':
        return 'destructive';
      default:
        return 'primary';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getActionTitle()}</Text>

      <View style={styles.habitInfo}>
        <HeadingLarge style={styles.habitName}>{action.habit.name}</HeadingLarge>
        <View style={styles.details}>
          <BodyMedium>
            {action.habit.frequency === 'daily' ? 'Every day' : 'Weekly'}
          </BodyMedium>
          {action.habit.timeOfDay && action.habit.timeOfDay !== 'anytime' && (
            <>
              <Text style={styles.detailSeparator}>•</Text>
              <BodyMedium style={styles.detail}>{action.habit.timeOfDay}</BodyMedium>
            </>
          )}
        </View>
        {action.habit.reason && (
          <BodyMedium style={styles.reason}>{action.habit.reason}</BodyMedium>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title="Not now"
          variant="ghost"
          onPress={onDismiss}
          size="sm"
        />
        <Button
          title={getConfirmText()}
          variant={getButtonVariant()}
          onPress={onConfirm}
          size="sm"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: LIST_ITEM.marginHorizontal,
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.medium,
  },
  title: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  habitInfo: {
    marginBottom: SPACING.md,
  },
  habitName: {
    marginBottom: SPACING.xs,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  detail: {
    textTransform: 'capitalize',
  },
  detailSeparator: {
    marginHorizontal: SPACING.xs,
    color: COLORS.textLight,
  },
  reason: {
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
});
