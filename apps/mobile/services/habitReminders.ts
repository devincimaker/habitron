import * as Notifications from 'expo-notifications';
import { HABIT_WEEKDAYS, Habit, HabitLogEntry, getTodayDate } from '@habits-coach/shared';
import { addMinutesToTime, getHourMinute } from '../utils/habitTime';
import { getDaysSinceStart, getHabitEndDate, isHabitDueOnDate } from '../utils/habitSchedule';

const IDENTIFIER_PREFIX = 'habit:';
/** iOS silently drops pending local notifications beyond 64. */
const MAX_SCHEDULED = 60;
/** Constant reminders re-fire at these offsets (minutes) after the reminder time. */
const CONSTANT_REMINDER_OFFSETS = [30, 60, 90];
/** Interval habits cannot be expressed as a repeating trigger; schedule the next few dates. */
const INTERVAL_OCCURRENCES = 6;

interface PlannedNotification {
  identifier: string;
  title: string;
  body: string;
  trigger: Notifications.NotificationTriggerInput;
}

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    permissionGranted = true;
  } else {
    const requested = await Notifications.requestPermissionsAsync();
    permissionGranted = requested.status === 'granted';
  }
  permissionChecked = true;
  return permissionGranted;
}

function buildTriggers(habit: Habit, time: string): Notifications.NotificationTriggerInput[] {
  const { hour, minute } = getHourMinute(time);

  switch (habit.frequency) {
    case 'daily': {
      const days = habit.weeklyDays ?? [];
      if (days.length === 0 || days.length === 7) {
        return [{ type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }];
      }
      return days.map((day) => ({
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: HABIT_WEEKDAYS.indexOf(day) + 1,
        hour,
        minute,
      }));
    }

    case 'weekly':
      return [{ type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }];

    case 'interval': {
      const every = habit.intervalDays ?? 2;
      const today = getTodayDate();
      const daysSinceStart = getDaysSinceStart(habit, today);
      const offsetToNext =
        daysSinceStart < 0 ? -daysSinceStart : (every - (daysSinceStart % every)) % every;
      const now = new Date();
      const triggers: Notifications.NotificationTriggerInput[] = [];

      for (let index = 0; index < INTERVAL_OCCURRENCES; index++) {
        const fireAt = new Date(today + 'T00:00:00');
        fireAt.setDate(fireAt.getDate() + offsetToNext + index * every);
        fireAt.setHours(hour, minute, 0, 0);
        if (fireAt <= now) continue;
        if (!isHabitDueOnDate(habit, fireAt)) continue;
        triggers.push({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt });
      }

      return triggers;
    }
  }
}

function planNotifications(
  habits: Habit[],
  todayLogs: Map<string, HabitLogEntry>
): PlannedNotification[] {
  const today = getTodayDate();
  const planned: PlannedNotification[] = [];

  for (const habit of habits) {
    if (!habit.active || habit.reminderTimes.length === 0) continue;

    const endDate = getHabitEndDate(habit);
    if (endDate && endDate < today) continue;

    const todayStatus = todayLogs.get(habit.id)?.status ?? 'pending';
    const isDoneToday = todayStatus !== 'pending';

    for (const time of habit.reminderTimes) {
      const times = [{ time, suffix: 'main' }];
      // Follow-ups are skipped once the habit is logged today; the next sync
      // (app launch, next check-in) re-adds them for the following day.
      if (habit.constantReminder && !isDoneToday) {
        CONSTANT_REMINDER_OFFSETS.forEach((offset) =>
          times.push({ time: addMinutesToTime(time, offset), suffix: `f${offset}` })
        );
      }

      for (const entry of times) {
        for (const [index, trigger] of buildTriggers(habit, entry.time).entries()) {
          planned.push({
            identifier: `${IDENTIFIER_PREFIX}${habit.id}:${time}:${entry.suffix}:${index}`,
            title: entry.suffix === 'main' ? habit.name : `Still pending: ${habit.name}`,
            body:
              entry.suffix === 'main'
                ? 'Time for your habit.'
                : "You haven't logged this habit yet today.",
            trigger,
          });
        }
      }
    }
  }

  return planned;
}

/**
 * Replace every scheduled habit reminder with the set implied by the current
 * habits. Safe to call often; it is idempotent for an unchanged habit list.
 */
export async function syncHabitReminders(
  habits: Habit[],
  todayLogs: Map<string, HabitLogEntry>
): Promise<void> {
  try {
    const planned = planNotifications(habits, todayLogs);
    if (planned.length > 0 && !(await ensurePermission())) {
      return;
    }

    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((notification) => notification.identifier.startsWith(IDENTIFIER_PREFIX))
        .map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier)
        )
    );

    if (planned.length > MAX_SCHEDULED) {
      console.warn(
        `Habit reminders: ${planned.length} notifications planned, scheduling the first ${MAX_SCHEDULED}.`
      );
    }

    for (const notification of planned.slice(0, MAX_SCHEDULED)) {
      await Notifications.scheduleNotificationAsync({
        identifier: notification.identifier,
        content: {
          title: notification.title,
          body: notification.body,
          sound: true,
          data: { action: 'open_habits' },
        },
        trigger: notification.trigger,
      });
    }
  } catch (error) {
    console.error('Failed to sync habit reminders:', error);
  }
}
