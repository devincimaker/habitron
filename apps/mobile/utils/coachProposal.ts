import type {
  ChatMessage,
  CoachAction,
  CoachProposal,
  Goal,
  Habit,
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

function isHabitFrequency(value: unknown): value is 'daily' | 'weekly' {
  return value === 'daily' || value === 'weekly';
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
      if (action.operation === 'create') {
        if (!isNonEmptyString(action.habit.name)) {
          return 'Habit create actions must include a name.';
        }

        return isHabitFrequency(action.habit.frequency)
          ? null
          : 'Habit create actions must include a valid frequency.';
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

    case 'journal':
      return isNonEmptyString(action.entry.content)
        ? null
        : 'Journal create actions must include content.';
  }
}

function getNonEmptyLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getGoalLabel(goalId: string, context?: CoachActionDescriptionContext): string | null {
  const goal = context?.goals?.find((item) => item.id === goalId);
  return getNonEmptyLabel(goal?.title);
}

function getTodoLabel(todoId: string, context?: CoachActionDescriptionContext): string | null {
  const todo = context?.todos?.find((item) => item.id === todoId);
  return getNonEmptyLabel(todo?.title);
}

function getHabitDetailLabel(habit: Habit, includeReason: boolean): string | null {
  const details: string[] = [];

  if (habit.frequency === 'weekly' && typeof habit.weeklyCount === 'number') {
    details.push(`${habit.weeklyCount}x/week`);
  } else {
    details.push(habit.frequency);
  }

  if (habit.timeOfDay) {
    details.push(habit.timeOfDay);
  }

  if (includeReason) {
    const reason = getNonEmptyLabel(habit.reason);
    if (reason) {
      details.push(reason);
    }
  }

  return details.length > 0 ? details.join(', ') : null;
}

function getHabitLabel(habitId: string, context?: CoachActionDescriptionContext): string | null {
  const habit = context?.habits?.find((item) => item.id === habitId);
  if (!habit) {
    return null;
  }

  const name = getNonEmptyLabel(habit.name);
  if (!name) {
    return null;
  }

  const sameNameHabits = (context?.habits ?? []).filter((item) => item.name === habit.name);
  let detailLabel = getHabitDetailLabel(habit, false);

  if (sameNameHabits.length > 1) {
    const baseDetailSet = new Set(
      sameNameHabits.map((item) => getHabitDetailLabel(item, false) ?? '')
    );

    if (baseDetailSet.size !== sameNameHabits.length) {
      detailLabel = getHabitDetailLabel(habit, true);
    }

    const enrichedDetailSet = new Set(
      sameNameHabits.map((item) => getHabitDetailLabel(item, true) ?? '')
    );

    if (enrichedDetailSet.size !== sameNameHabits.length) {
      const shortId = habit.id.slice(-4);
      detailLabel = detailLabel ? `${detailLabel}, #${shortId}` : `#${shortId}`;
    }
  }

  return detailLabel ? `${name} (${detailLabel})` : name;
}

export function describeCoachAction(
  action: CoachAction,
  context?: CoachActionDescriptionContext
): string {
  switch (action.entity) {
    case 'goal':
      if (action.operation === 'add') {
        const goalTitle = getNonEmptyLabel(action.goal.title);
        return goalTitle ? `Add goal: ${goalTitle}` : 'Add goal';
      }
      if (action.operation === 'edit') {
        const goalTitle = getGoalLabel(action.goalId, context);
        return goalTitle ? `Update goal: ${goalTitle}` : 'Update goal';
      }
      {
        const goalTitle = getGoalLabel(action.goalId, context);
        return goalTitle ? `Archive goal: ${goalTitle}` : 'Archive goal';
      }
    case 'habit':
      if (action.operation === 'create') {
        const habitName = getNonEmptyLabel(action.habit.name);
        return habitName ? `Create habit: ${habitName}` : 'Create habit';
      }
      if (action.operation === 'expand') {
        const habitLabel = getHabitLabel(action.habitId, context);
        return habitLabel ? `Expand habit: ${habitLabel}` : 'Expand habit';
      }
      if (action.operation === 'contract') {
        const habitLabel = getHabitLabel(action.habitId, context);
        return habitLabel ? `Contract habit: ${habitLabel}` : 'Contract habit';
      }
      {
        const habitLabel = getHabitLabel(action.habitId, context);
        return habitLabel ? `Archive habit: ${habitLabel}` : 'Archive habit';
      }
    case 'todo':
      if (action.operation === 'add') {
        const taskTitle = getNonEmptyLabel(action.todo.title);
        return taskTitle ? `Add task: ${taskTitle}` : 'Add task';
      }
      if (action.operation === 'edit') {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Update task: ${taskTitle}` : 'Update task';
      }
      if (action.operation === 'schedule') {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Reschedule task: ${taskTitle}` : 'Reschedule task';
      }
      if (action.operation === 'unschedule') {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Unschedule task: ${taskTitle}` : 'Unschedule task';
      }
      if (action.operation === 'complete') {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Complete task: ${taskTitle}` : 'Complete task';
      }
      if (action.operation === 'cancel') {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Cancel task: ${taskTitle}` : 'Cancel task';
      }
      if (action.operation === 'reopen') {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Reopen task: ${taskTitle}` : 'Reopen task';
      }
      {
        const taskTitle = getTodoLabel(action.todoId, context);
        return taskTitle ? `Remove task: ${taskTitle}` : 'Remove task';
      }
    case 'journal':
      return getNonEmptyLabel(action.entry.content)
        ? 'Save journal entry'
        : 'Save note';
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
