import {
  HABIT_WEEKDAYS,
  Habit,
  HabitLogEntry,
  HabitStatus,
  HabitWeekday,
} from '@habits-coach/shared';

export { HABIT_WEEKDAYS };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDefaultWeeklyDays(): HabitWeekday[] {
  return [...HABIT_WEEKDAYS];
}

function toLocalMidnight(date: string | Date): Date {
  const target = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  target.setHours(0, 0, 0, 0);
  return target;
}

export function getDayNameForDate(date: string | Date): HabitWeekday {
  return HABIT_WEEKDAYS[toLocalMidnight(date).getDay()];
}

/** Whole days from the habit's start date to the target date (negative before start). */
export function getDaysSinceStart(habit: Pick<Habit, 'startDate'>, date: string | Date): number {
  const start = toLocalMidnight(habit.startDate);
  const target = toLocalMidnight(date);
  return Math.round((target.getTime() - start.getTime()) / MS_PER_DAY);
}

/** YYYY-MM-DD of the last day the habit runs, or undefined when it runs forever. */
export function getHabitEndDate(
  habit: Pick<Habit, 'startDate' | 'goalDays'>
): string | undefined {
  if (!habit.goalDays) return undefined;
  const end = toLocalMidnight(habit.startDate);
  end.setDate(end.getDate() + habit.goalDays - 1);
  return [
    end.getFullYear(),
    String(end.getMonth() + 1).padStart(2, '0'),
    String(end.getDate()).padStart(2, '0'),
  ].join('-');
}

export function isHabitDueOnDate(habit: Habit, date: string | Date): boolean {
  if (!habit.active) {
    return false;
  }

  const daysSinceStart = getDaysSinceStart(habit, date);
  if (daysSinceStart < 0) {
    return false;
  }

  if (habit.goalDays && daysSinceStart >= habit.goalDays) {
    return false;
  }

  switch (habit.frequency) {
    case 'daily':
      if (!habit.weeklyDays || habit.weeklyDays.length === 0) {
        return true;
      }
      return habit.weeklyDays.includes(getDayNameForDate(date));

    case 'weekly':
      return true;

    case 'interval':
      return daysSinceStart % (habit.intervalDays ?? 1) === 0;
  }
}

/** Resolve the log entry that results from recording `amount` against a habit. */
export function resolveLogForAmount(habit: Habit, amount: number): HabitLogEntry {
  const clamped = Math.max(0, amount);
  if (habit.goalType !== 'quantity') {
    return { status: clamped > 0 ? 'completed' : 'pending', amount: 0 };
  }

  const target = habit.targetAmount ?? 1;
  return { status: clamped >= target ? 'completed' : 'pending', amount: clamped };
}

/** Resolve the log entry that results from explicitly setting a status. */
export function resolveLogForStatus(habit: Habit, status: HabitStatus): HabitLogEntry {
  if (status === 'completed') {
    return {
      status,
      amount: habit.goalType === 'quantity' ? habit.targetAmount ?? 1 : 0,
    };
  }
  return { status, amount: 0 };
}

/** The amount a single check-in adds for an auto check-in quantity habit. */
export function getCheckInIncrement(habit: Habit): number {
  if (habit.goalType !== 'quantity') return 1;
  if (habit.checkInMode === 'complete_all') return habit.targetAmount ?? 1;
  return habit.recordIncrement ?? 1;
}

export function formatHabitProgress(habit: Habit, amount: number): string {
  const target = habit.targetAmount ?? 1;
  const unit = habit.unit ?? 'Count';
  const unitLabel = unit === 'Count' ? '' : ` ${unit.toLowerCase()}${target === 1 ? '' : 's'}`;
  return `${formatAmount(amount)}/${formatAmount(target)}${unitLabel}`;
}

export function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function describeHabitSchedule(habit: Habit): string {
  switch (habit.frequency) {
    case 'daily': {
      const days = habit.weeklyDays ?? [];
      if (days.length === 0 || days.length === 7) return 'Every day';
      return HABIT_WEEKDAYS.filter((day) => days.includes(day)).join(', ');
    }
    case 'weekly': {
      const count = habit.weeklyCount ?? 1;
      return `${count}× per week`;
    }
    case 'interval': {
      const every = habit.intervalDays ?? 2;
      return `Every ${every} days`;
    }
  }
}
