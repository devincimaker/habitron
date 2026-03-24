import { StyleSheet, View } from 'react-native';
import type { DailyPlan } from '@habits-coach/shared';
import { BodyMedium, Button, Card, Caption, HeadingLarge, Label } from './ui';
import { COLORS, SPACING } from '../constants/theme';

interface DailyPlanCardProps {
  plan: DailyPlan | null;
  onPlanWithCoach: () => void;
}

const BLOCK_ORDER = ['morning', 'afternoon', 'evening'] as const;

export function DailyPlanCard({ plan, onPlanWithCoach }: DailyPlanCardProps) {
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
        <Label color={COLORS.primary}>v{plan.version}</Label>
      </View>

      {plan.rationale ? (
        <BodyMedium style={styles.rationale}>{plan.rationale}</BodyMedium>
      ) : null}

      {BLOCK_ORDER.map((block) => {
        const items = plan.items.filter((item) => item.scheduledBlock === block);
        if (items.length === 0) return null;

        return (
          <View key={block} style={styles.blockSection}>
            <Caption style={styles.blockLabel}>{block.toUpperCase()}</Caption>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemBullet} />
                <View style={styles.itemContent}>
                  <BodyMedium color={COLORS.text}>
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
          </View>
        );
      })}

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

const styles = StyleSheet.create({
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
  blockSection: {
    marginTop: SPACING.sm,
  },
  blockLabel: {
    color: COLORS.primaryDark,
    marginBottom: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.xs,
  },
  itemBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
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
