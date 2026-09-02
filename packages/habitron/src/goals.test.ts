import { describe, expect, it } from 'vitest';
import type { Task } from './db.js';
import { goalsForDay, goalsWithTasks, type GoalRecord } from './goals.js';

const TODAY = '2026-09-02';

function goal(overrides: Partial<GoalRecord> & { id: string }): GoalRecord {
  return {
    title: 'Ship the app',
    measure: 'Listed on the store',
    targetDate: '2026-11-01',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    listId: 'inbox',
    title: 'Task',
    status: 'open',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('goalsForDay', () => {
  it('counts days left and the tasks pointing at the goal, canceled ones left out', () => {
    const [forDay] = goalsForDay(
      [goal({ id: 'g1' })],
      [
        task({ id: 't1', goalId: 'g1', status: 'completed', completedAt: '2026-08-20T10:00:00Z' }),
        task({ id: 't2', goalId: 'g1' }),
        task({ id: 't3', goalId: 'g1', status: 'canceled' }),
        task({ id: 't4' }),
      ],
      TODAY
    );

    expect(forDay).toMatchObject({ id: 'g1', daysLeft: 60, tasks: { done: 1, total: 2 } });
  });

  it('reads a passed date as negative days, and a goal with no tasks as 0 of 0', () => {
    const [forDay] = goalsForDay([goal({ id: 'g1', targetDate: '2026-08-31' })], [], TODAY);

    expect(forDay.daysLeft).toBe(-2);
    expect(forDay.tasks).toEqual({ done: 0, total: 0 });
  });

  // Planning is about the open goals; a finished one is history.
  it('leaves done goals out', () => {
    const forDay = goalsForDay(
      [goal({ id: 'done', completedAt: '2026-08-21T14:00:00Z' }), goal({ id: 'open' })],
      [],
      TODAY
    );

    expect(forDay.map((g) => g.id)).toEqual(['open']);
  });
});

describe('goalsWithTasks', () => {
  const goals = [goal({ id: 'open' }), goal({ id: 'done', completedAt: '2026-08-21T14:00:00Z' })];
  const tasks = [
    task({ id: 't1', goalId: 'open', scheduledDate: TODAY }),
    task({ id: 't2', goalId: 'open', status: 'canceled' }),
  ];

  it('carries each task as the review needs it, and only the open goals by default', () => {
    const listed = goalsWithTasks(goals, tasks, TODAY, false);

    expect(listed).toHaveLength(1);
    expect(listed[0].tasks).toEqual([
      { id: 't1', title: 'Task', status: 'open', scheduledDate: TODAY, completedAt: undefined },
    ]);
  });

  it('adds the done goals when asked', () => {
    expect(goalsWithTasks(goals, tasks, TODAY, true).map((g) => g.id)).toEqual(['open', 'done']);
  });
});
