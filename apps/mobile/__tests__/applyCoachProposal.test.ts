import type { CoachProposal } from '@habits-coach/shared';
import { applyCoachProposal } from '../utils/applyCoachProposal';

type ApplyCoachProposalDeps = Parameters<typeof applyCoachProposal>[1];

function createDeps(): jest.Mocked<ApplyCoachProposalDeps> {
  return {
    addGoal: jest.fn(),
    updateGoal: jest.fn(),
    archiveGoal: jest.fn(),
    addHabit: jest.fn(),
    updateHabit: jest.fn(),
    archiveHabit: jest.fn(),
    addTodo: jest.fn(),
    updateTodo: jest.fn(),
    setTodoStatus: jest.fn(),
    removeTodo: jest.fn(),
    saveAcceptedPlan: jest.fn(),
    existingPlanId: undefined,
  };
}

describe('applyCoachProposal habit management', () => {
  it('creates a habit and resolves its client key', async () => {
    const deps = createDeps();
    deps.addHabit.mockResolvedValue({
      id: 'habit-1',
      name: 'Walk after lunch',
      frequency: 'daily',
      active: true,
      createdAt: Date.now(),
    });

    const proposal: CoachProposal = {
      actions: [
        {
          entity: 'habit',
          operation: 'create',
          clientKey: 'habit-new',
          habit: {
            name: 'Walk after lunch',
            frequency: 'daily',
          },
        },
      ],
    };

    const resolvedRefs = await applyCoachProposal(proposal, deps);

    expect(deps.addHabit).toHaveBeenCalledWith({
      name: 'Walk after lunch',
      frequency: 'daily',
    });
    expect(resolvedRefs.get('habit-new')).toBe('habit-1');
  });

  it('uses updateHabit for expand and contract actions', async () => {
    const deps = createDeps();

    const proposal: CoachProposal = {
      actions: [
        {
          entity: 'habit',
          operation: 'expand',
          habitId: 'habit-1',
          changes: {
            weeklyCount: 4,
          },
        },
        {
          entity: 'habit',
          operation: 'contract',
          habitId: 'habit-2',
          changes: {
            weeklyCount: 2,
            reason: 'Make it easier to sustain',
          },
        },
      ],
    };

    await applyCoachProposal(proposal, deps);

    expect(deps.updateHabit).toHaveBeenNthCalledWith(1, 'habit-1', {
      weeklyCount: 4,
    });
    expect(deps.updateHabit).toHaveBeenNthCalledWith(2, 'habit-2', {
      weeklyCount: 2,
      reason: 'Make it easier to sustain',
    });
    expect(deps.archiveHabit).not.toHaveBeenCalled();
  });

  it('archives habits instead of deleting them', async () => {
    const deps = createDeps();

    const proposal: CoachProposal = {
      actions: [
        {
          entity: 'habit',
          operation: 'archive',
          habitId: 'habit-3',
        },
      ],
    };

    await applyCoachProposal(proposal, deps);

    expect(deps.archiveHabit).toHaveBeenCalledWith('habit-3');
  });

  it('rejects malformed habit archive actions before touching persistence', async () => {
    const deps = createDeps();

    const proposal = {
      actions: [
        {
          entity: 'habit',
          operation: 'archive',
          habitId: undefined,
        },
      ],
    } as unknown as CoachProposal;

    await expect(applyCoachProposal(proposal, deps)).rejects.toThrow(
      'Habit archive actions must include a habitId.'
    );
    expect(deps.archiveHabit).not.toHaveBeenCalled();
  });
});
