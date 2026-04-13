import { Habit } from '@habits-coach/shared';
import {
  getDayNameForDate,
  isHabitDueOnDate,
} from '../utils/habitSchedule';

const baseHabit: Habit = {
  id: 'habit-1',
  name: 'Read',
  frequency: 'daily',
  active: true,
  createdAt: new Date('2026-04-01T08:00:00Z').getTime(),
};

describe('habitSchedule', () => {
  it('returns the expected weekday label for a date string', () => {
    expect(getDayNameForDate('2026-04-09')).toBe('Thu');
  });

  it('treats daily habits with no weekday list as due every day', () => {
    expect(isHabitDueOnDate(baseHabit, '2026-04-09')).toBe(true);
  });

  it('filters daily habits by selected weekdays', () => {
    const habit: Habit = {
      ...baseHabit,
      weeklyDays: ['Mon', 'Thu'],
    };

    expect(isHabitDueOnDate(habit, '2026-04-09')).toBe(true);
    expect(isHabitDueOnDate(habit, '2026-04-10')).toBe(false);
  });

  it('keeps weekly habits visible on any day after creation', () => {
    const habit: Habit = {
      ...baseHabit,
      frequency: 'weekly',
      weeklyCount: 3,
    };

    expect(isHabitDueOnDate(habit, '2026-04-09')).toBe(true);
    expect(isHabitDueOnDate(habit, '2026-04-10')).toBe(true);
  });

  it('does not show habits before their creation date', () => {
    expect(isHabitDueOnDate(baseHabit, '2026-03-31')).toBe(false);
  });
});
