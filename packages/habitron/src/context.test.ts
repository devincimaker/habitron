import { describe, expect, it } from 'vitest';
import { resolveDesiredHabits, type HabitForDay } from './context.js';

function habit(overrides: Partial<HabitForDay> & { id: string; name: string }): HabitForDay {
  return {
    frequency: 'daily',
    startDate: '2026-08-01',
    goalType: 'boolean',
    checkInMode: 'auto',
    constantReminder: false,
    reminderTimes: [],
    active: true,
    dueOnDate: true,
    statusOnDate: 'pending',
    completedThisWeek: 0,
    completedLast14Days: 0,
    ...overrides,
  };
}

describe('resolveDesiredHabits', () => {
  it('reads as not started when no habit stands in for it', () => {
    const [resolved] = resolveDesiredHabits(
      [{ id: 'd1', title: 'Read every night', note: 'after the kids are down' }],
      []
    );

    expect(resolved).toEqual({
      id: 'd1',
      title: 'Read every night',
      note: 'after the kids are down',
      workingOnIt: null,
    });
  });

  it('resolves the habit standing in for it, with its recent count', () => {
    const [resolved] = resolveDesiredHabits(
      [{ id: 'd1', title: 'Read every night', habitId: 'h1' }],
      [habit({ id: 'h1', name: 'Read 5 pages', completedLast14Days: 9, startDate: '2026-08-10' })]
    );

    expect(resolved.workingOnIt).toEqual({
      id: 'h1',
      name: 'Read 5 pages',
      active: true,
      frequency: 'daily',
      startDate: '2026-08-10',
      completedLast14Days: 9,
    });
  });

  // The point of resolving against archived habits too: an abandoned attempt is
  // signal about what was already tried, not noise to hide.
  it('still resolves an archived habit, and says it is archived', () => {
    const [resolved] = resolveDesiredHabits(
      [{ id: 'd1', title: 'Run in the mornings', habitId: 'h1' }],
      [habit({ id: 'h1', name: 'Run 2km', active: false, completedLast14Days: 1 })]
    );

    expect(resolved.workingOnIt).toMatchObject({ id: 'h1', active: false, completedLast14Days: 1 });
  });

  // The FK is ON DELETE SET NULL, so a deleted habit leaves habitId undefined;
  // a habitId with no matching habit has to read the same way.
  it('reads as not started when the habit is gone', () => {
    const [resolved] = resolveDesiredHabits(
      [{ id: 'd1', title: 'Journal daily', habitId: 'deleted' }],
      [habit({ id: 'h1', name: 'Read 5 pages' })]
    );

    expect(resolved.workingOnIt).toBeNull();
  });

  it('keeps the order it was given', () => {
    const resolved = resolveDesiredHabits(
      [
        { id: 'd1', title: 'First' },
        { id: 'd2', title: 'Second' },
        { id: 'd3', title: 'Third' },
      ],
      []
    );

    expect(resolved.map((row) => row.title)).toEqual(['First', 'Second', 'Third']);
  });
});
