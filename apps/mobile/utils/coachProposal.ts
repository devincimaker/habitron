import type { CoachAction, CoachProposal } from '@habits-coach/shared';

export function describeCoachAction(action: CoachAction): string {
  switch (action.entity) {
    case 'goal':
      if (action.operation === 'add') return `Add goal: ${action.goal.title}`;
      if (action.operation === 'edit') return 'Update goal';
      return 'Archive goal';
    case 'habit':
      if (action.operation === 'add') return `Add habit: ${action.habit.name}`;
      if (action.operation === 'edit') return 'Update habit';
      return 'Remove habit';
    case 'todo':
      if (action.operation === 'add') return `Add task: ${action.todo.title}`;
      if (action.operation === 'edit') return 'Update task';
      if (action.operation === 'schedule') return 'Reschedule task';
      if (action.operation === 'unschedule') return 'Unschedule task';
      if (action.operation === 'complete') return 'Complete task';
      if (action.operation === 'cancel') return 'Cancel task';
      if (action.operation === 'reopen') return 'Reopen task';
      return 'Remove task';
    case 'diary':
    case 'journal':
      return 'Save journal entry';
  }
}

export function getProposalSummary(proposal: CoachProposal): string {
  const parts: string[] = [];

  if (proposal.actions.length > 0) {
    parts.push(
      `${proposal.actions.length} ${proposal.actions.length === 1 ? 'change' : 'changes'}`
    );
  }

  if (proposal.dailyPlanDraft) {
    parts.push('daily plan');
  }

  if (parts.length === 0) {
    return 'No changes proposed';
  }

  return parts.join(' and ');
}

export function getProposalAppliedMessage(proposal: CoachProposal): string {
  const summaries = proposal.actions.slice(0, 3).map(describeCoachAction);

  if (proposal.dailyPlanDraft) {
    summaries.push(`Saved your ${proposal.dailyPlanDraft.date} plan`);
  }

  if (summaries.length === 0) {
    return 'Everything is set.';
  }

  return `${summaries.join('. ')}.`;
}
