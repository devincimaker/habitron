import type {
  CoachAction,
  CoachProposal,
  DailyPlan,
  Goal,
  Habit,
  HabitDraft,
  Todo,
} from '@habits-coach/shared';
import { assertExecutableCoachProposal } from './coachProposal';

type GoalInput = Extract<CoachAction, { entity: 'goal'; operation: 'add' }>['goal'];
type GoalChanges = Extract<CoachAction, { entity: 'goal'; operation: 'edit' }>['changes'];
type HabitInput = Extract<CoachAction, { entity: 'habit'; operation: 'create' }>['habit'];
type HabitChanges = Partial<HabitDraft>;
type TodoInput = Extract<CoachAction, { entity: 'todo'; operation: 'add' }>['todo'];
type TodoChanges = Extract<CoachAction, { entity: 'todo'; operation: 'edit' }>['changes'];

interface ApplyCoachProposalDependencies {
  addGoal: (goal: GoalInput) => Promise<Goal>;
  updateGoal: (goalId: string, changes: GoalChanges) => Promise<Goal>;
  archiveGoal: (goalId: string) => Promise<Goal>;
  addHabit: (habit: HabitInput) => Promise<Habit>;
  updateHabit: (habitId: string, changes: HabitChanges) => Promise<Habit>;
  archiveHabit: (habitId: string) => Promise<Habit>;
  addTodo: (todo: TodoInput) => Promise<Todo>;
  updateTodo: (todoId: string, changes: TodoChanges) => Promise<Todo>;
  setTodoStatus: (todoId: string, status: Todo['status']) => Promise<Todo>;
  removeTodo: (todoId: string) => Promise<void>;
  saveAcceptedPlan: (
    draft: NonNullable<CoachProposal['dailyPlanDraft']>,
    resolvedRefs: Map<string, string>,
    parentPlanId?: string
  ) => Promise<DailyPlan>;
  existingPlanId?: string;
}

export async function applyCoachProposal(
  proposal: CoachProposal,
  deps: ApplyCoachProposalDependencies
): Promise<Map<string, string>> {
  assertExecutableCoachProposal(proposal);

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
        if (action.operation === 'create') {
          const habit = await deps.addHabit(action.habit);
          if (action.clientKey) resolvedRefs.set(action.clientKey, habit.id);
        } else if (action.operation === 'expand' || action.operation === 'contract') {
          await deps.updateHabit(action.habitId, action.changes);
        } else {
          await deps.archiveHabit(action.habitId);
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
            scheduledTime: action.scheduledTime,
          });
        } else if (action.operation === 'unschedule') {
          await deps.updateTodo(action.todoId, {
            scheduledDate: undefined,
            scheduledTime: undefined,
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
