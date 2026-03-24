import type {
  CoachProposal,
  Goal,
  Habit,
  JournalEntry,
  Todo,
} from '@habits-coach/shared';

interface ApplyCoachProposalDependencies {
  addGoal: (goal: any) => Promise<Goal>;
  updateGoal: (goalId: string, changes: any) => Promise<Goal>;
  archiveGoal: (goalId: string) => Promise<Goal>;
  addHabit: (habit: any) => Promise<Habit>;
  updateHabit: (habitId: string, changes: any) => Promise<Habit>;
  removeHabit: (habitId: string) => Promise<void>;
  addTodo: (todo: any) => Promise<Todo>;
  updateTodo: (todoId: string, changes: any) => Promise<Todo>;
  setTodoStatus: (todoId: string, status: Todo['status']) => Promise<Todo>;
  removeTodo: (todoId: string) => Promise<void>;
  addJournalEntry: (entry: any) => Promise<JournalEntry>;
  saveAcceptedPlan: (
    draft: NonNullable<CoachProposal['dailyPlanDraft']>,
    resolvedRefs: Map<string, string>,
    parentPlanId?: string
  ) => Promise<unknown>;
  existingPlanId?: string;
}

export async function applyCoachProposal(
  proposal: CoachProposal,
  deps: ApplyCoachProposalDependencies
): Promise<Map<string, string>> {
  const resolvedRefs = new Map<string, string>();

  for (const action of proposal.actions) {
    switch (action.entity) {
      case 'goal':
        if (action.operation === 'add') {
          const goal = await deps.addGoal(action.goal);
          if (action.clientKey) resolvedRefs.set(action.clientKey, goal.id);
        } else if (action.operation === 'edit') {
          await deps.updateGoal(action.goalId, action.changes);
        } else {
          await deps.archiveGoal(action.goalId);
        }
        break;

      case 'habit':
        if (action.operation === 'add') {
          const habit = await deps.addHabit(action.habit);
          if (action.clientKey) resolvedRefs.set(action.clientKey, habit.id);
        } else if (action.operation === 'edit') {
          await deps.updateHabit(action.habitId, action.changes);
        } else {
          await deps.removeHabit(action.habitId);
        }
        break;

      case 'todo':
        if (action.operation === 'add') {
          const todo = await deps.addTodo(action.todo);
          if (action.clientKey) resolvedRefs.set(action.clientKey, todo.id);
        } else if (action.operation === 'edit') {
          await deps.updateTodo(action.todoId, action.changes);
        } else if (action.operation === 'schedule') {
          await deps.updateTodo(action.todoId, {
            scheduledDate: action.scheduledDate,
            scheduledBlock: action.scheduledBlock,
          });
        } else if (action.operation === 'unschedule') {
          await deps.updateTodo(action.todoId, {
            scheduledDate: undefined,
            scheduledBlock: undefined,
          });
        } else if (action.operation === 'remove') {
          await deps.removeTodo(action.todoId);
        } else {
          const status =
            action.operation === 'complete'
              ? 'completed'
              : action.operation === 'cancel'
                ? 'canceled'
                : 'open';
          await deps.setTodoStatus(action.todoId, status);
        }
        break;

      case 'diary':
      case 'journal':
        await deps.addJournalEntry(action.entry);
        break;
    }
  }

  if (proposal.dailyPlanDraft) {
    await deps.saveAcceptedPlan(
      proposal.dailyPlanDraft,
      resolvedRefs,
      deps.existingPlanId
    );
  }

  return resolvedRefs;
}
