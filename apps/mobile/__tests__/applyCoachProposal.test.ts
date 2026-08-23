import { applyCoachProposal } from '../utils/applyCoachProposal';
import type { CoachProposal, Goal, Habit, JournalEntry, Todo } from '@habits-coach/shared';

function createGoal(id: string): Goal {
  return {
    id,
    title: 'Goal',
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
  };
}

function createHabit(id: string): Habit {
  return {
    id,
    name: 'Habit',
    frequency: 'daily',
    startDate: '2026-01-01',
    goalType: 'boolean',
    checkInMode: 'auto',
    reminderTimes: [],
    constantReminder: false,
    autoPopupLog: false,
    active: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

function createTodo(id: string, title = 'Todo'): Todo {
  return {
    id,
    title,
    status: 'open',
    tags: [],
    sortOrder: 0,
    listId: 'inbox',
    createdAt: 0,
    updatedAt: 0,
  };
}

function createJournalEntry(id: string): JournalEntry {
  return {
    id,
    entryDate: '2026-04-13',
    content: 'Entry',
    source: 'coach',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('applyCoachProposal', () => {
  it('creates backing todos for plan items that are missing refs', async () => {
    const addTodo = jest.fn(async (todo) => createTodo('todo-1', todo.title));
    const saveAcceptedPlan = jest.fn(async () => ({}));

    const proposal: CoachProposal = {
      actions: [],
      dailyPlanDraft: {
        date: '2026-04-13',
        items: [
          {
            itemType: 'todo',
            title: 'Buy groceries',
            scheduledTime: '13:00',
            estimateMinutes: 45,
          },
        ],
      },
    };

    await applyCoachProposal(proposal, {
      addGoal: async () => createGoal('goal-1'),
      updateGoal: async () => createGoal('goal-1'),
      archiveGoal: async () => createGoal('goal-1'),
      addHabit: async () => createHabit('habit-1'),
      updateHabit: async () => createHabit('habit-1'),
      archiveHabit: async () => ({ ...createHabit('habit-1'), active: false }),
      removeHabit: async () => {},
      addTodo,
      updateTodo: async () => createTodo('todo-1'),
      setTodoStatus: async () => createTodo('todo-1'),
      removeTodo: async () => {},
      addJournalEntry: async () => createJournalEntry('journal-1'),
      saveAcceptedPlan,
      existingPlanId: undefined,
    });

    expect(addTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Buy groceries',
        scheduledDate: '2026-04-13',
        scheduledTime: '13:00',
        estimateMinutes: 45,
      })
    );

    expect(saveAcceptedPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            itemType: 'todo',
            ref: { kind: 'action', clientKey: 'daily-plan-todo-0' },
          }),
        ],
      }),
      expect.any(Map),
      undefined
    );
  });

  it('archives habits without deleting them', async () => {
    const archiveHabit = jest.fn(async () => ({ ...createHabit('habit-1'), active: false }));
    const removeHabit = jest.fn(async () => {});

    const proposal: CoachProposal = {
      actions: [
        {
          entity: 'habit',
          operation: 'archive',
          habitId: 'habit-1',
        },
      ],
    };

    await applyCoachProposal(proposal, {
      addGoal: async () => createGoal('goal-1'),
      updateGoal: async () => createGoal('goal-1'),
      archiveGoal: async () => createGoal('goal-1'),
      addHabit: async () => createHabit('habit-1'),
      updateHabit: async () => createHabit('habit-1'),
      archiveHabit,
      removeHabit,
      addTodo: async () => createTodo('todo-1'),
      updateTodo: async () => createTodo('todo-1'),
      setTodoStatus: async () => createTodo('todo-1'),
      removeTodo: async () => {},
      addJournalEntry: async () => createJournalEntry('journal-1'),
      saveAcceptedPlan: async () => ({}),
      existingPlanId: undefined,
    });

    expect(archiveHabit).toHaveBeenCalledWith('habit-1');
    expect(removeHabit).not.toHaveBeenCalled();
  });
});
