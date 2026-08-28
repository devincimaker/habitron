import type { Habit, HabitLogEntry } from '@habits-coach/shared';
import { isHabitDueOnDate } from './habitSchedule';

export interface RoutineProgress {
  /** Every habit of the routine due today, in the order the routine runs. */
  due: Habit[];
  /** The one the takeover is asking about, or undefined when the routine is done. */
  current?: Habit;
  /** 1-based position of `current` within `due`, for "2 of 3". */
  index: number;
  /** The names still to come after `current`. */
  upcoming: string[];
}

/**
 * A routine's habits for one date, in the order the routine runs them.
 *
 * The alarm's title, the sheet's preview and the takeover all have to name the
 * same "first habit", or the lock screen announces one and the screen opens on
 * another. One definition, so they cannot drift apart.
 */
export function dueRoutineHabits(sectionId: string, habits: Habit[], date: string): Habit[] {
  return habits
    .filter((habit) => habit.sectionId === sectionId && isHabitDueOnDate(habit, date))
    .sort((a, b) => a.position - b.position);
}

/**
 * Where a routine stands right now. The takeover resolves this live on every
 * check-in rather than walking a list it captured when it opened — a habit
 * logged from somewhere else should not leave the screen asking about it.
 */
export function getRoutineProgress(
  sectionId: string,
  habits: Habit[],
  logs: Map<string, HabitLogEntry>,
  today: string
): RoutineProgress {
  const due = dueRoutineHabits(sectionId, habits, today);

  const currentIndex = due.findIndex(
    (habit) => (logs.get(habit.id)?.status ?? 'pending') === 'pending'
  );

  if (currentIndex === -1) {
    return { due, current: undefined, index: due.length, upcoming: [] };
  }

  return {
    due,
    current: due[currentIndex],
    index: currentIndex + 1,
    upcoming: due.slice(currentIndex + 1).map((habit) => habit.name),
  };
}
