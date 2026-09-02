import type { DailyPlan } from '@habits-coach/shared';

jest.mock('../services/dailyPlans', () => ({
  getDailyPlan: jest.fn(),
  updateDailyPlanItemOutcome: jest.fn(),
}));

import * as dailyPlansService from '../services/dailyPlans';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';

const date = '2026-09-02';
const plan = {
  id: 'plan-1',
  planDate: date,
  status: 'accepted',
  source: 'coach',
  items: [
    { id: 'item-todo', kind: 'todo', todoId: 'todo-1', outcome: 'planned' },
    { id: 'item-habit', kind: 'habit', habitId: 'habit-1', outcome: 'planned' },
  ],
} as unknown as DailyPlan;

describe('useDailyPlansStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDailyPlansStore.setState({ plansByDate: { [date]: plan }, isLoading: false });
  });

  it('marks the outcome before the write lands', async () => {
    let settle: () => void = () => undefined;
    (dailyPlansService.updateDailyPlanItemOutcome as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => { settle = resolve; })
    );

    const pending = useDailyPlansStore.getState().updateOutcomeForTodo(date, 'todo-1', 'completed_as_planned');

    expect(useDailyPlansStore.getState().plansByDate[date]?.items[0]).toMatchObject({
      outcome: 'completed_as_planned',
      resolvedAt: expect.any(Number),
    });
    expect(dailyPlansService.updateDailyPlanItemOutcome).toHaveBeenCalledWith('item-todo', 'completed_as_planned');

    settle();
    await pending;
  });

  it('puts the old outcome back when the write fails', async () => {
    (dailyPlansService.updateDailyPlanItemOutcome as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(
      useDailyPlansStore.getState().updateOutcomeForHabit(date, 'habit-1', 'not_done')
    ).rejects.toThrow('offline');

    expect(useDailyPlansStore.getState().plansByDate[date]).toEqual(plan);
  });

  it('does nothing for an item the plan does not have', async () => {
    await useDailyPlansStore.getState().updateOutcomeForTodo(date, 'todo-missing', 'completed_as_planned');

    expect(dailyPlansService.updateDailyPlanItemOutcome).not.toHaveBeenCalled();
    expect(useDailyPlansStore.getState().plansByDate[date]).toBe(plan);
  });
});
