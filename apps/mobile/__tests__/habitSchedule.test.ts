import { Habit } from '@habits-coach/shared';
import {
  describeHabitSchedule,
  formatHabitProgress,
  getCheckInIncrement,
  getDayNameForDate,
  getHabitEndDate,
  isHabitDueOnDate,
  resolveLogForAmount,
  resolveLogForStatus,
} from '../utils/habitSchedule';

const baseHabit: Habit = {
  id: 'habit-1',
  name: 'Read',
  frequency: 'daily',
  position: 0,
  startDate: '2026-04-01',
  goalType: 'boolean',
  checkInMode: 'auto',
  reminderTimes: [],
  constantReminder: false,
  active: true,
  createdAt: new Date('2026-04-01T08:00:00Z').getTime(),
};

const quantityHabit: Habit = {
  ...baseHabit,
  id: 'habit-water',
  name: 'Drink water',
  goalType: 'quantity',
  targetAmount: 8,
  unit: 'Cup',
  checkInMode: 'auto',
  recordIncrement: 2,
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

  it('keeps weekly habits visible on any day after the start date', () => {
    const habit: Habit = {
      ...baseHabit,
      frequency: 'weekly',
      weeklyCount: 3,
    };

    expect(isHabitDueOnDate(habit, '2026-04-09')).toBe(true);
    expect(isHabitDueOnDate(habit, '2026-04-10')).toBe(true);
  });

  it('does not show habits before their start date', () => {
    expect(isHabitDueOnDate(baseHabit, '2026-03-31')).toBe(false);
  });

  it('respects a start date that is later than the creation date', () => {
    const habit: Habit = { ...baseHabit, startDate: '2026-04-10' };

    expect(isHabitDueOnDate(habit, '2026-04-09')).toBe(false);
    expect(isHabitDueOnDate(habit, '2026-04-10')).toBe(true);
  });

  it('shows interval habits only every N days from the start date', () => {
    const habit: Habit = { ...baseHabit, frequency: 'interval', intervalDays: 3 };

    expect(isHabitDueOnDate(habit, '2026-04-01')).toBe(true);
    expect(isHabitDueOnDate(habit, '2026-04-02')).toBe(false);
    expect(isHabitDueOnDate(habit, '2026-04-03')).toBe(false);
    expect(isHabitDueOnDate(habit, '2026-04-04')).toBe(true);
    expect(isHabitDueOnDate(habit, '2026-04-07')).toBe(true);
  });

  it('stops showing habits once their goal days have elapsed', () => {
    const habit: Habit = { ...baseHabit, goalDays: 7 };

    expect(isHabitDueOnDate(habit, '2026-04-07')).toBe(true);
    expect(isHabitDueOnDate(habit, '2026-04-08')).toBe(false);
    expect(getHabitEndDate(habit)).toBe('2026-04-07');
    expect(getHabitEndDate(baseHabit)).toBeUndefined();
  });

  it('hides inactive habits', () => {
    expect(isHabitDueOnDate({ ...baseHabit, active: false }, '2026-04-09')).toBe(false);
  });

  it('describes schedules for display', () => {
    expect(describeHabitSchedule(baseHabit)).toBe('Every day');
    expect(describeHabitSchedule({ ...baseHabit, weeklyDays: ['Wed', 'Mon'] })).toBe('Mon, Wed');
    expect(describeHabitSchedule({ ...baseHabit, frequency: 'weekly', weeklyCount: 3 })).toBe(
      '3× per week'
    );
    expect(describeHabitSchedule({ ...baseHabit, frequency: 'interval', intervalDays: 4 })).toBe(
      'Every 4 days'
    );
  });
});

describe('habit log resolution', () => {
  it('marks boolean habits complete for any positive amount', () => {
    expect(resolveLogForAmount(baseHabit, 1)).toEqual({ status: 'completed', amount: 0 });
    expect(resolveLogForAmount(baseHabit, 0)).toEqual({ status: 'pending', amount: 0 });
  });

  it('accumulates quantity amounts and completes at the target', () => {
    expect(resolveLogForAmount(quantityHabit, 6)).toEqual({ status: 'pending', amount: 6 });
    expect(resolveLogForAmount(quantityHabit, 8)).toEqual({ status: 'completed', amount: 8 });
    expect(resolveLogForAmount(quantityHabit, 10)).toEqual({ status: 'completed', amount: 10 });
    expect(resolveLogForAmount(quantityHabit, -3)).toEqual({ status: 'pending', amount: 0 });
  });

  it('fills the target when a quantity habit is marked complete by status', () => {
    expect(resolveLogForStatus(quantityHabit, 'completed')).toEqual({
      status: 'completed',
      amount: 8,
    });
    expect(resolveLogForStatus(quantityHabit, 'skipped')).toEqual({ status: 'skipped', amount: 0 });
    expect(resolveLogForStatus(baseHabit, 'completed')).toEqual({ status: 'completed', amount: 0 });
  });

  it('uses the record increment for auto check-ins and the target for complete-all', () => {
    expect(getCheckInIncrement(quantityHabit)).toBe(2);
    expect(getCheckInIncrement({ ...quantityHabit, checkInMode: 'complete_all' })).toBe(8);
    expect(getCheckInIncrement(baseHabit)).toBe(1);
  });

  it('formats progress with the unit', () => {
    expect(formatHabitProgress(quantityHabit, 3)).toBe('3/8 cups');
    expect(formatHabitProgress({ ...quantityHabit, unit: 'Count', targetAmount: 5 }, 2)).toBe('2/5');
    expect(formatHabitProgress({ ...quantityHabit, unit: 'Hour', targetAmount: 1 }, 0.5)).toBe(
      '0.5/1 hour'
    );
  });
});
