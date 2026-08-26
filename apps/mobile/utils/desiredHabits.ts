import type { DesiredHabit, Habit } from '@habits-coach/shared';

/**
 * The caption under a desired habit's title. There is no status column: a
 * desired habit is started when a habit stands in for it, and back to
 * not-started when that habit is gone.
 */
export function describeDesiredHabit(desired: DesiredHabit, habits: Habit[]): string {
  if (!desired.habitId) return 'Not started';

  const habit = habits.find((candidate) => candidate.id === desired.habitId);
  if (!habit) return 'Not started';

  return `${habit.name} working on it`;
}
