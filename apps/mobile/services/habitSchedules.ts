import type { Habit, HabitLogEntry, HabitSection } from '@habits-coach/shared';
import { syncHabitReminders } from './habitReminders';
import { syncRoutineAlarms } from './routineAlarms';

/**
 * Everything the app schedules from the habit list, behind one call.
 *
 * Habit reminders are notifications and routine alarms are AlarmKit alarms —
 * different mechanisms, but they go stale for the same reasons, so the store
 * has one thing to remember to call after a mutation rather than two.
 */
export async function syncHabitSchedules(
  habits: Habit[],
  sections: HabitSection[],
  todayLogs: Map<string, HabitLogEntry>
): Promise<void> {
  await Promise.all([
    syncHabitReminders(habits, todayLogs),
    syncRoutineAlarms(sections, habits, new Date()),
  ]);
}
