import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CoachProposal } from '@habits-coach/shared';
import { Button, Card, BodyMedium, Caption, HeadingLarge, Label } from './ui';
import { SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, LIST_ITEM, type Colors } from '../constants/theme';
import {
  describeCoachAction,
  getProposalSummary,
  type CoachActionDescriptionContext,
} from '../utils/coachProposal';
import { formatTodoScheduledTime } from '../utils/todoTime';
import { useThemedStyles } from '../hooks/useColors';

export type CoachProposalCardStatus = 'pending' | 'applying' | 'applied';

interface CoachProposalCardProps {
  proposal: CoachProposal;
  status: CoachProposalCardStatus;
  actionContext?: CoachActionDescriptionContext;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function CoachProposalCard({
  proposal,
  status,
  actionContext,
  onConfirm,
  onDismiss,
}: CoachProposalCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const planDraft = proposal.dailyPlanDraft;

  return (
    <View style={styles.container}>
      <Label color={colors.primary} style={styles.eyebrow}>
        Coach Proposal
      </Label>
      <HeadingLarge>{getProposalSummary(proposal)}</HeadingLarge>

      {proposal.actions.length > 0 && (
        <View style={styles.section}>
          {proposal.actions.map((action, index) => (
            <View key={`${action.entity}-${action.operation}-${index}`} style={styles.actionRow}>
              <View style={styles.actionBullet} />
              <BodyMedium color={colors.text}>
                {describeCoachAction(action, actionContext)}
              </BodyMedium>
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
              <Caption style={styles.planTime}>
                {formatTodoScheduledTime(item.scheduledTime) ?? item.scheduledTime}
              </Caption>
              <BodyMedium color={colors.text}>
                {item.title}
                {item.isOptional ? ' (optional)' : ''}
              </BodyMedium>
            </View>
          ))}
        </Card>
      )}

      {status === 'applied' ? (
        <View style={styles.appliedRow}>
          <View style={styles.appliedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <BodyMedium color={colors.success}>Accepted</BodyMedium>
          </View>
          <Caption style={styles.appliedCaption}>
            Changes accepted. You can keep chatting from here.
          </Caption>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            title="Not now"
            variant="ghost"
            onPress={onDismiss}
            size="sm"
            disabled={status === 'applying'}
          />
          <Button
            title="Accept"
            onPress={onConfirm}
            size="sm"
            loading={status === 'applying'}
            disabled={status === 'applying'}
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    marginHorizontal: LIST_ITEM.marginHorizontal,
    marginVertical: SPACING.sm,
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.primary,
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
    backgroundColor: colors.primary,
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
  planTime: {
    width: 64,
    color: colors.primaryDark,
    ...TYPOGRAPHY.caption,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  appliedRow: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  appliedCaption: {
    color: colors.textSecondary,
  },
});
