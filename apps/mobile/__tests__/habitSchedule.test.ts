import { Habit } from '@habits-coach/shared';
import {
  formatHabitSchedule,
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

  it('formats daily and weekly schedule summaries', () => {
    expect(formatHabitSchedule(baseHabit)).toBe('Every day');
    expect(
      formatHabitSchedule({
        ...baseHabit,
        weeklyDays: ['Mon', 'Wed', 'Fri'],
      })
    ).toBe('Mon, Wed, Fri');
    expect(
      formatHabitSchedule({
        ...baseHabit,
        frequency: 'weekly',
        weeklyCount: 2,
      })
    ).toBe('2 times / week');
  });
});
