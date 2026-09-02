import type { Goal, Todo } from '@habits-coach/shared';
import {
  countGoalTasks,
  daysUntil,
  describeDaysLeft,
  describeGoalMeta,
  goalReviewState,
} from '../utils/goals';

const TODAY = '2026-09-02';

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  title: 'Deadlift 140 kg',
  measure: '1 clean rep at 140 kg, on video',
  targetDate: '2027-03-01',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const todo = (goalId: string | undefined, status: Todo['status']): Todo => ({
  id: `todo-${Math.random()}`,
  title: 't',
  status,
  position: 0,
  listId: 'list-1',
  goalId,
  createdAt: 0,
  updatedAt: 0,
});

describe('daysUntil', () => {
  it('counts whole days forward and back', () => {
    expect(daysUntil('2026-09-03', TODAY)).toBe(1);
    expect(daysUntil('2026-09-02', TODAY)).toBe(0);
    expect(daysUntil('2026-08-31', TODAY)).toBe(-2);
    expect(daysUntil('2027-03-01', TODAY)).toBe(180);
  });
});

describe('describeDaysLeft', () => {
  it('reads the clock in words', () => {
    expect(describeDaysLeft('2027-03-01', TODAY)).toBe('180 days left');
    expect(describeDaysLeft('2026-09-03', TODAY)).toBe('1 day left');
    expect(describeDaysLeft('2026-09-02', TODAY)).toBe('Due today');
    expect(describeDaysLeft('2026-08-21', TODAY)).toBe('12 days over');
  });
});

describe('countGoalTasks', () => {
  it('counts the tasks pointing at the goal, canceled ones left out', () => {
    const todos = [
      todo('goal-1', 'open'),
      todo('goal-1', 'completed'),
      todo('goal-1', 'canceled'),
      todo('goal-2', 'completed'),
      todo(undefined, 'open'),
    ];
    expect(countGoalTasks('goal-1', todos)).toEqual({ done: 1, total: 2 });
  });
});

describe('describeGoalMeta', () => {
  it('joins the date, the clock and the count', () => {
    expect(describeGoalMeta(goal(), { done: 3, total: 7 }, TODAY)).toBe(
      'Mar 1, 2027 · 180 days left · 3 of 7 tasks done'
    );
  });

  it('leaves the count out when no task points at the goal', () => {
    expect(describeGoalMeta(goal(), { done: 0, total: 0 }, TODAY)).toBe(
      'Mar 1, 2027 · 180 days left'
    );
  });

  it('reads the completion date on a done goal', () => {
    const done = goal({ completedAt: Date.UTC(2026, 7, 20, 12) });
    expect(describeGoalMeta(done, { done: 2, total: 2 }, TODAY)).toBe('Done Aug 20, 2026');
  });
});

describe('goalReviewState', () => {
  const stamp = (daysAgo: number) => {
    const d = new Date(`${TODAY}T12:00:00`);
    d.setDate(d.getDate() - daysAgo);
    return d.getTime();
  };

  it('names the goals never reviewed first', () => {
    const goals = [goal({ reviewedAt: stamp(1) }), goal({ id: 'goal-2' })];
    expect(goalReviewState(goals, TODAY)).toEqual({ due: true, label: '1 goal not yet reviewed' });
  });

  it('stays quiet inside the week', () => {
    const goals = [goal({ reviewedAt: stamp(3) }), goal({ id: 'goal-2', reviewedAt: stamp(1) })];
    expect(goalReviewState(goals, TODAY)).toEqual({ due: false, label: 'Reviewed 3 days ago' });
  });

  it('turns into the nudge at a week, on the oldest review', () => {
    const goals = [goal({ reviewedAt: stamp(9) }), goal({ id: 'goal-2', reviewedAt: stamp(0) })];
    expect(goalReviewState(goals, TODAY)).toEqual({
      due: true,
      label: 'Due · last reviewed 9 days ago',
    });
  });

  it('ignores done goals', () => {
    const goals = [goal({ reviewedAt: stamp(0) }), goal({ id: 'goal-2', completedAt: 1 })];
    expect(goalReviewState(goals, TODAY)).toEqual({ due: false, label: 'Reviewed today' });
  });
});
