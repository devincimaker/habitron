import { View, StyleSheet } from 'react-native';
import type { CoachProposal } from '@habits-coach/shared';
import { Button, Card, BodyMedium, Caption, HeadingLarge, Label } from './ui';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, LIST_ITEM } from '../constants/theme';
import { describeCoachAction, getProposalSummary } from '../utils/coachProposal';

interface CoachProposalCardProps {
  proposal: CoachProposal;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function CoachProposalCard({
  proposal,
  onConfirm,
  onDismiss,
}: CoachProposalCardProps) {
  const planDraft = proposal.dailyPlanDraft;

  return (
    <View style={styles.container}>
      <Label color={COLORS.primary} style={styles.eyebrow}>
        Coach Proposal
      </Label>
      <HeadingLarge>{getProposalSummary(proposal)}</HeadingLarge>

      {proposal.actions.length > 0 && (
        <View style={styles.section}>
          {proposal.actions.map((action, index) => (
            <View key={`${action.entity}-${action.operation}-${index}`} style={styles.actionRow}>
              <View style={styles.actionBullet} />
              <BodyMedium color={COLORS.text}>{describeCoachAction(action)}</BodyMedium>
            </View>
          ))}
        </View>
      )}

      {planDraft && (
        <Card variant="surface" style={styles.planCard}>
          <HeadingLarge style={styles.planTitle}>Daily Plan</HeadingLarge>
          {planDraft.rationale ? (
            <BodyMedium style={styles.planRationale}>{planDraft.rationale}</BodyMedium>
          ) : null}
          {planDraft.items.map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.planItemRow}>
              <Caption style={styles.planBlock}>
                {item.scheduledBlock.toUpperCase()}
              </Caption>
              <BodyMedium color={COLORS.text}>
                {item.title}
                {item.isOptional ? ' (optional)' : ''}
              </BodyMedium>
            </View>
          ))}
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          title="Not now"
          variant="ghost"
          onPress={onDismiss}
          size="sm"
        />
        <Button
          title="Apply"
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
  eyebrow: {
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  actionBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 7,
  },
  planCard: {
    marginTop: SPACING.md,
    marginBottom: 0,
  },
  planTitle: {
    marginBottom: SPACING.xs,
  },
  planRationale: {
    marginBottom: SPACING.sm,
  },
  planItemRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  planBlock: {
    width: 82,
    color: COLORS.primaryDark,
    ...TYPOGRAPHY.caption,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
