import { StyleSheet, View } from 'react-native';
import type { DailyPlan } from '@habits-coach/shared';
import { BodyMedium, Button, Card, Caption, HeadingLarge, Label } from './ui';
import { SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { compareTodoScheduledTimes, formatTodoScheduledTime } from '../utils/todoTime';

interface DailyPlanCardProps {
  plan: DailyPlan | null;
  onPlanWithCoach: () => void;
}

export function DailyPlanCard({
  plan, onPlanWithCoach }: DailyPlanCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  if (!plan || plan.items.length === 0) {
    return (
      <Card style={styles.card}>
        <HeadingLarge style={styles.title}>Today&apos;s Plan</HeadingLarge>
        <BodyMedium style={styles.emptyText}>
          No coach plan yet. Habitron can propose a focused day based on your tasks, habits, goals, and journal.
        </BodyMedium>
        <Button
          title="Plan With Habitron"
          onPress={onPlanWithCoach}
          size="sm"
          style={styles.button}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <HeadingLarge>Today&apos;s Plan</HeadingLarge>
        <Label color={colors.primary}>v{plan.version}</Label>
      </View>

      {plan.rationale ? (
        <BodyMedium style={styles.rationale}>{plan.rationale}</BodyMedium>
      ) : null}

      {plan.items
        .slice()
        .sort(
          (left, right) =>
            compareTodoScheduledTimes(left.scheduledTime, right.scheduledTime)
            || left.position - right.position
        )
        .map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Caption style={styles.timeLabel}>
              {formatTodoScheduledTime(item.scheduledTime) ?? item.scheduledTime}
            </Caption>
            <View style={styles.itemBullet} />
            <View style={styles.itemContent}>
              <BodyMedium color={colors.text}>
                {item.titleSnapshot}
                {item.isOptional ? ' (optional)' : ''}
              </BodyMedium>
              {item.notesSnapshot ? (
                <Caption>{item.notesSnapshot}</Caption>
              ) : null}
            </View>
            {item.outcome !== 'planned' ? (
              <Caption style={styles.outcome}>{formatOutcome(item.outcome)}</Caption>
            ) : null}
          </View>
        ))}

      <Button
        title="Replan With Habitron"
        variant="outline"
        onPress={onPlanWithCoach}
        size="sm"
        style={styles.button}
      />
    </Card>
  );
}

function formatOutcome(outcome: DailyPlan['items'][number]['outcome']): string {
  switch (outcome) {
    case 'completed_as_planned':
      return 'Done';
    case 'completed_after_adjustment':
      return 'Adjusted';
    case 'deferred':
      return 'Deferred';
    case 'removed':
      return 'Removed';
    case 'canceled':
      return 'Canceled';
    case 'not_done':
      return 'Missed';
    default:
      return 'Planned';
  }
}

const createStyles = (colors: Colors) => StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    marginBottom: SPACING.sm,
  },
  emptyText: {
    marginBottom: SPACING.md,
  },
  rationale: {
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.sm,
  },
  timeLabel: {
    color: colors.primaryDark,
    width: 56,
    marginTop: 1,
  },
  itemBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: SPACING.sm,
  },
  itemContent: {
    flex: 1,
  },
  outcome: {
    marginLeft: SPACING.sm,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
  },
});
