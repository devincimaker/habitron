import type { DesiredHabit, Habit } from '@habits-coach/shared';
import { describeDesiredHabit } from '../utils/desiredHabits';

const habit: Habit = {
  id: 'habit-1',
  name: 'Run',
  frequency: 'weekly',
  weeklyCount: 3,
  startDate: '2026-08-01',
  goalType: 'boolean',
  checkInMode: 'auto',
  reminderTimes: [],
  constantReminder: false,
  autoPopupLog: false,
  active: true,
  createdAt: new Date('2026-08-01T08:00:00Z').getTime(),
};

const desired: DesiredHabit = {
  id: 'desired-1',
  title: 'Strength training twice a week',
  createdAt: new Date('2026-08-20T08:00:00Z').getTime(),
};

describe('describeDesiredHabit', () => {
  it('reads Not started when no habit stands in for it', () => {
    expect(describeDesiredHabit(desired, [habit])).toBe('Not started');
  });

  it('names the habit standing in for it', () => {
    expect(describeDesiredHabit({ ...desired, habitId: 'habit-1' }, [habit])).toBe(
      'Run working on it'
    );
  });

  it('falls back to Not started when the linked habit is gone', () => {
    // ON DELETE SET NULL leaves the column clear, but the store can still be
    // holding a stale id between the delete and the next load.
    expect(describeDesiredHabit({ ...desired, habitId: 'habit-gone' }, [habit])).toBe(
      'Not started'
    );
  });

  it('falls back to Not started when no habits are loaded yet', () => {
    expect(describeDesiredHabit({ ...desired, habitId: 'habit-1' }, [])).toBe('Not started');
  });

  it('names an archived habit too: it is still what was started', () => {
    const archived = { ...habit, active: false };
    expect(describeDesiredHabit({ ...desired, habitId: 'habit-1' }, [archived])).toBe(
      'Run working on it'
    );
  });
});
