import {
  withHabitDraftDefaults,
  type CoachProposal,
  type DailyPlanDraft,
  type DailyPlanDraftItem,
  type Goal,
  type Habit,
  type HabitDraft,
  type JournalEntry,
  type Todo,
} from '@habits-coach/shared';

interface ApplyCoachProposalDependencies {
  addGoal: (goal: any) => Promise<Goal>;
  updateGoal: (goalId: string, changes: any) => Promise<Goal>;
  archiveGoal: (goalId: string) => Promise<Goal>;
  addHabit: (habit: HabitDraft) => Promise<Habit>;
  updateHabit: (habitId: string, changes: Partial<HabitDraft>) => Promise<Habit>;
  archiveHabit: (habitId: string) => Promise<Habit>;
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

function buildSyntheticDailyPlanTodoKey(index: number): string {
  return `daily-plan-todo-${index}`;
}

function hasActionClientKey(proposal: CoachProposal, clientKey: string): boolean {
  return proposal.actions.some(
    (action) => 'clientKey' in action && action.clientKey === clientKey
  );
}

function normalizeDraftItemForPersistence(
  item: DailyPlanDraftItem,
  proposal: CoachProposal
): DailyPlanDraftItem {
  if (item.itemType === 'note') {
    return item;
  }

  if (!item.ref) {
    return {
      ...item,
      itemType: 'note',
    };
  }

  if (item.ref.kind === 'action' && !hasActionClientKey(proposal, item.ref.clientKey)) {
    return {
      ...item,
      itemType: 'note',
      ref: undefined,
    };
  }

  return item;
}

function enrichProposalForApply(proposal: CoachProposal): CoachProposal {
  if (!proposal.dailyPlanDraft) {
    return proposal;
  }

  const syntheticActions = proposal.dailyPlanDraft.items.flatMap((item, index) => {
    if (item.itemType !== 'todo' || item.ref) {
      return [];
    }

    return [
      {
        entity: 'todo' as const,
        operation: 'add' as const,
        clientKey: buildSyntheticDailyPlanTodoKey(index),
        todo: {
          title: item.title,
          notes: item.notes,
          scheduledDate: proposal.dailyPlanDraft?.date,
          scheduledTime: item.scheduledTime,
          estimateMinutes: item.estimateMinutes,
        },
      },
    ];
  });

  const draft: DailyPlanDraft = {
    ...proposal.dailyPlanDraft,
    items: proposal.dailyPlanDraft.items.map((item, index) => {
      if (item.itemType === 'todo' && !item.ref) {
        return {
          ...item,
          ref: {
            kind: 'action' as const,
            clientKey: buildSyntheticDailyPlanTodoKey(index),
          },
        };
      }

      return normalizeDraftItemForPersistence(item, proposal);
    }),
  };

  return {
    ...proposal,
    actions: [...proposal.actions, ...syntheticActions],
    dailyPlanDraft: draft,
  };
}

export async function applyCoachProposal(
  proposal: CoachProposal,
  deps: ApplyCoachProposalDependencies
): Promise<Map<string, string>> {
  const proposalToApply = enrichProposalForApply(proposal);
  const resolvedRefs = new Map<string, string>();

  for (const action of proposalToApply.actions) {
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
          const habit = await deps.addHabit(withHabitDraftDefaults(action.habit));
          if (action.clientKey) resolvedRefs.set(action.clientKey, habit.id);
        } else if (action.operation === 'edit') {
          await deps.updateHabit(action.habitId, action.changes);
        } else if (action.operation === 'archive') {
          await deps.archiveHabit(action.habitId);
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

      case 'diary':
      case 'journal':
        await deps.addJournalEntry(action.entry);
        break;
    }
  }

  if (proposalToApply.dailyPlanDraft) {
    await deps.saveAcceptedPlan(
      proposalToApply.dailyPlanDraft,
      resolvedRefs,
      deps.existingPlanId
    );
  }

  return resolvedRefs;
}
