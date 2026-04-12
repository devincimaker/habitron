import { HABIT_WEEKDAYS, Habit, HabitWeekday } from '@habits-coach/shared';

export { HABIT_WEEKDAYS };

export function getDefaultWeeklyDays(): HabitWeekday[] {
  return [...HABIT_WEEKDAYS];
}

export function getDayNameForDate(date: string | Date): HabitWeekday {
  const targetDate =
    typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);

  return HABIT_WEEKDAYS[targetDate.getDay()];
}

export function isHabitDueOnDate(habit: Habit, date: string | Date): boolean {
  if (!habit.active) {
    return false;
  }

  const targetDate =
    typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const createdDate = new Date(habit.createdAt);
  createdDate.setHours(0, 0, 0, 0);

  if (createdDate > targetDate) {
    return false;
  }

  if (habit.frequency === 'daily') {
    if (!habit.weeklyDays || habit.weeklyDays.length === 0) {
      return true;
    }

    return habit.weeklyDays.includes(getDayNameForDate(targetDate));
  }

  if (habit.frequency === 'weekly') {
    return true;
  }

  return false;
}

export function formatHabitSchedule(habit: Habit): string {
  if (habit.frequency === 'weekly') {
    const weeklyCount = habit.weeklyCount ?? 1;
    return `${weeklyCount} ${weeklyCount === 1 ? 'time' : 'times'} / week`;
  }

  if (!habit.weeklyDays || habit.weeklyDays.length === 0) {
    return 'Every day';
  }

  if (habit.weeklyDays.length === HABIT_WEEKDAYS.length) {
    return 'Every day';
  }

  return habit.weeklyDays.join(', ');
}
