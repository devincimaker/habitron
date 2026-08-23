import type {
  ChatMessage,
  CoachAction,
  CoachProposal,
  Goal,
  Habit,
  HabitFrequency,
  Todo,
} from '@habits-coach/shared';

export interface PendingCoachProposal {
  messageId: string;
  proposal: CoachProposal;
}

export interface CoachActionDescriptionContext {
  goals?: Goal[];
  habits?: Habit[];
  todos?: Todo[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHabitFrequency(value: unknown): value is HabitFrequency {
  return value === 'daily' || value === 'weekly' || value === 'interval';
}

function findGoalTitle(goalId: string, context?: CoachActionDescriptionContext): string | null {
  return context?.goals?.find((goal) => goal.id === goalId)?.title ?? null;
}

function findHabitName(habitId: string, context?: CoachActionDescriptionContext): string | null {
  return context?.habits?.find((habit) => habit.id === habitId)?.name ?? null;
}

function describeTodoForAction(todoId: string, context?: CoachActionDescriptionContext): string | null {
  const todo = context?.todos?.find((currentTodo) => currentTodo.id === todoId);
  if (!todo) {
    return null;
  }

  const duplicateTitleCount = context?.todos?.filter(
    (currentTodo) =>
      currentTodo.title.trim().toLowerCase() === todo.title.trim().toLowerCase()
  ).length ?? 0;

  if (duplicateTitleCount <= 1) {
    return todo.title;
  }

  const qualifiers = [
    todo.scheduledDate
      ? `scheduled ${todo.scheduledDate}${todo.scheduledTime ? ` at ${todo.scheduledTime}` : ''}`
      : 'unscheduled',
    todo.dueDate ? `due ${todo.dueDate}` : null,
    todo.status !== 'open' ? todo.status : null,
    `id ${todo.id.slice(0, 4)}`,
  ].filter(Boolean);

  return `${todo.title} (${qualifiers.join(', ')})`;
}

export function describeCoachAction(
  action: CoachAction,
  context?: CoachActionDescriptionContext
): string {
  switch (action.entity) {
    case 'goal':
      if (action.operation === 'add') return `Add goal: ${action.goal.title}`;
      if (action.operation === 'edit') {
        const title = findGoalTitle(action.goalId, context);
        return title ? `Update goal: ${title}` : 'Update goal';
      }
      return findGoalTitle(action.goalId, context)
        ? `Archive goal: ${findGoalTitle(action.goalId, context)}`
        : 'Archive goal';
    case 'habit':
      if (action.operation === 'add') return `Add habit: ${action.habit.name}`;
      if (action.operation === 'edit') {
        const name = findHabitName(action.habitId, context);
        return name ? `Update habit: ${name}` : 'Update habit';
      }
      if (action.operation === 'archive') {
        return findHabitName(action.habitId, context)
          ? `Archive habit: ${findHabitName(action.habitId, context)}`
          : 'Archive habit';
      }
      return findHabitName(action.habitId, context)
        ? `Remove habit: ${findHabitName(action.habitId, context)}`
        : 'Remove habit';
    case 'todo':
      if (action.operation === 'add') return `Add task: ${action.todo.title}`;
      if (action.operation === 'edit') {
        const title = describeTodoForAction(action.todoId, context);
        return title ? `Update task: ${title}` : 'Update task';
      }
      if (action.operation === 'schedule') {
        const title = describeTodoForAction(action.todoId, context);
        return title ? `Reschedule task: ${title}` : 'Reschedule task';
      }
      if (action.operation === 'unschedule') {
        const title = describeTodoForAction(action.todoId, context);
        return title ? `Unschedule task: ${title}` : 'Unschedule task';
      }
      if (action.operation === 'complete') {
        const title = describeTodoForAction(action.todoId, context);
        return title ? `Complete task: ${title}` : 'Complete task';
      }
      if (action.operation === 'cancel') {
        const title = describeTodoForAction(action.todoId, context);
        return title ? `Cancel task: ${title}` : 'Cancel task';
      }
      if (action.operation === 'reopen') {
        const title = describeTodoForAction(action.todoId, context);
        return title ? `Reopen task: ${title}` : 'Reopen task';
      }
      return describeTodoForAction(action.todoId, context)
        ? `Remove task: ${describeTodoForAction(action.todoId, context)}`
        : 'Remove task';
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

export function getProposalAppliedMessage(
  proposal: CoachProposal,
  context?: CoachActionDescriptionContext
): string {
  const summaries = proposal.actions.slice(0, 3).map((action) => describeCoachAction(action, context));

  if (proposal.dailyPlanDraft) {
    summaries.push(`Saved your ${proposal.dailyPlanDraft.date} plan`);
  }

  if (summaries.length === 0) {
    return 'Everything is set.';
  }

  return `${summaries.join('. ')}.`;
}

export function getCoachProposalDebugSummaries(proposal: CoachProposal): string[] {
  const summaries = proposal.actions.map((action) => `${action.entity}:${action.operation}`);

  if (proposal.dailyPlanDraft) {
    summaries.push(`dailyPlan:${proposal.dailyPlanDraft.date}`);
  }

  return summaries;
}

function getCoachActionValidationError(action: CoachAction): string | null {
  switch (action.entity) {
    case 'goal':
      if (action.operation === 'add') {
        return isNonEmptyString(action.goal.title)
          ? null
          : 'Goal add actions must include a title.';
      }

      return isNonEmptyString(action.goalId)
        ? null
        : `Goal ${action.operation} actions must include a goalId.`;

    case 'habit':
      if (action.operation === 'add') {
        if (!isNonEmptyString(action.habit.name)) {
          return 'Habit add actions must include a name.';
        }

        return isHabitFrequency(action.habit.frequency)
          ? null
          : 'Habit add actions must include a valid frequency.';
      }

      return isNonEmptyString(action.habitId)
        ? null
        : `Habit ${action.operation} actions must include a habitId.`;

    case 'todo':
      if (action.operation === 'add') {
        return isNonEmptyString(action.todo.title)
          ? null
          : 'Task add actions must include a title.';
      }

      return isNonEmptyString(action.todoId)
        ? null
        : `Task ${action.operation} actions must include a todoId.`;

    case 'diary':
    case 'journal':
      return action.entry ? null : 'Journal create actions must include an entry.';
  }
}

export function getCoachProposalValidationError(proposal: CoachProposal): string | null {
  for (const action of proposal.actions) {
    const error = getCoachActionValidationError(action);
    if (error) {
      return error;
    }
  }

  return null;
}

export function assertExecutableCoachProposal(proposal: CoachProposal): void {
  const validationError = getCoachProposalValidationError(proposal);
  if (validationError) {
    throw new Error(validationError);
  }
}

function getProposalMessage(message: ChatMessage): PendingCoachProposal | null {
  if (message.role !== 'assistant' || !message.proposal) {
    return null;
  }

  if (getCoachProposalValidationError(message.proposal)) {
    return null;
  }

  return {
    messageId: message.id,
    proposal: message.proposal,
  };
}

export function getLatestCoachProposal(
  messages: ChatMessage[]
): PendingCoachProposal | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const proposalMessage = getProposalMessage(messages[index]);
    if (proposalMessage) {
      return proposalMessage;
    }
  }

  return null;
}

export function getPendingCoachProposal(
  messages: ChatMessage[],
  resolvedMessageIds: ReadonlySet<string>
): PendingCoachProposal | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const proposalMessage = getProposalMessage(messages[index]);

    if (!proposalMessage || resolvedMessageIds.has(proposalMessage.messageId)) {
      continue;
    }

    return proposalMessage;
  }

  return null;
}
