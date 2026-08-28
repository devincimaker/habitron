import type { Habit, HabitLogEntry } from '@habits-coach/shared';
import { getRoutineProgress } from '../utils/routineProgress';

const TODAY = '2026-08-24';
const SECTION = 'morning';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Meditate',
    frequency: 'daily',
    startDate: '2026-01-01',
    goalType: 'boolean',
    checkInMode: 'manual',
    reminderTimes: [],
    constantReminder: false,
    active: true,
    position: 0,
    createdAt: 0,
    sectionId: SECTION,
    ...overrides,
  };
}

function logs(entries: Record<string, HabitLogEntry['status']>): Map<string, HabitLogEntry> {
  return new Map(
    Object.entries(entries).map(([id, status]) => [id, { status, amount: 0 }])
  );
}

const routine = [
  habit({ id: 'a', name: 'Meditate', position: 0 }),
  habit({ id: 'b', name: 'Stretch', position: 1 }),
  habit({ id: 'c', name: 'Drink water', position: 2 }),
];

describe('getRoutineProgress', () => {
  it('starts at the first habit with nothing logged', () => {
    const progress = getRoutineProgress(SECTION, routine, logs({}), TODAY);

    expect(progress.current?.name).toBe('Meditate');
    expect(progress.index).toBe(1);
    expect(progress.due).toHaveLength(3);
    expect(progress.upcoming).toEqual(['Stretch', 'Drink water']);
  });

  it('skips a habit already logged, however it was logged', () => {
    const progress = getRoutineProgress(
      SECTION,
      routine,
      logs({ a: 'completed', b: 'skipped' }),
      TODAY
    );

    expect(progress.current?.name).toBe('Drink water');
    expect(progress.index).toBe(3);
    expect(progress.upcoming).toEqual([]);
  });

  it('has no current habit once the routine is done', () => {
    const progress = getRoutineProgress(
      SECTION,
      routine,
      logs({ a: 'completed', b: 'completed', c: 'completed' }),
      TODAY
    );

    expect(progress.current).toBeUndefined();
    expect(progress.index).toBe(3);
  });

  it('reads position, not array order', () => {
    const progress = getRoutineProgress(
      SECTION,
      [habit({ id: 'b', name: 'Stretch', position: 1 }), habit({ id: 'a', name: 'Meditate', position: 0 })],
      logs({}),
      TODAY
    );

    expect(progress.current?.name).toBe('Meditate');
  });

  it('leaves out a habit that is not due today', () => {
    const progress = getRoutineProgress(
      SECTION,
      [
        habit({ id: 'a', name: 'Meditate', position: 0, frequency: 'daily', weeklyDays: ['Sun'] }),
        habit({ id: 'b', name: 'Stretch', position: 1 }),
      ],
      logs({}),
      TODAY
    );

    expect(progress.due.map((entry) => entry.name)).toEqual(['Stretch']);
    expect(progress.current?.name).toBe('Stretch');
  });

  it('leaves out an archived habit', () => {
    const progress = getRoutineProgress(
      SECTION,
      [habit({ id: 'a', position: 0, active: false }), habit({ id: 'b', name: 'Stretch', position: 1 })],
      logs({}),
      TODAY
    );

    expect(progress.current?.name).toBe('Stretch');
  });

  it('ignores habits from another routine', () => {
    const progress = getRoutineProgress(
      SECTION,
      [habit({ id: 'x', name: 'Read', sectionId: 'night', position: 0 }), ...routine],
      logs({}),
      TODAY
    );

    expect(progress.due.map((entry) => entry.name)).toEqual([
      'Meditate',
      'Stretch',
      'Drink water',
    ]);
  });

  it('is empty for a routine with nothing due', () => {
    const progress = getRoutineProgress(SECTION, [], logs({}), TODAY);

    expect(progress.due).toEqual([]);
    expect(progress.current).toBeUndefined();
    expect(progress.index).toBe(0);
  });
});
