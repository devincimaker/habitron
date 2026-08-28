import * as Sentry from '@sentry/react-native';
import {
  HABIT_WEEKDAYS,
  type Habit,
  type HabitSection,
  type HabitWeekday,
} from '@habits-coach/shared';
import RoutineAlarms, { type RoutineAlarm } from '../modules/routine-alarms';
import { toDateString } from '../utils/dateUtils';
import { getDayNameForDate } from '../utils/habitSchedule';
import { getHourMinute } from '../utils/habitTime';
import { dueRoutineHabits } from '../utils/routineProgress';

/**
 * Stable per section and time, so re-planning re-schedules the same alarm
 * instead of piling up duplicates. AlarmKit takes a UUID, and a v5-style hash
 * would need a crypto dependency for no gain: the section id is already a
 * UUID, so overwriting its last two hex digits with the time's index keeps the
 * shape and stays deterministic.
 */
function alarmId(sectionId: string, timeIndex: number): string {
  return `${sectionId.slice(0, -2)}${timeIndex.toString(16).padStart(2, '0')}`;
}

/**
 * YYYY-MM-DD of the date the alarm next rings on.
 *
 * Today counts only while its own ring is still ahead — past it, AlarmKit fires
 * next week, and a title built from today would name the wrong habit whenever
 * the two days have different ones due.
 */
function nextFireDate(now: Date, weekdays: HabitWeekday[], time: string): string | undefined {
  if (weekdays.length === 0) return undefined;
  const wanted = new Set(weekdays);
  const { hour, minute } = getHourMinute(time);
  const alreadyRang = now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cursor.setDate(cursor.getDate() + (alreadyRang ? 1 : 0));

  for (let offset = 0; offset < 7; offset++) {
    if (wanted.has(getDayNameForDate(cursor))) {
      return toDateString(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return undefined;
}

/**
 * The alarm's title names the routine and the habit that opens it. "First" here
 * is `position` order, not log state — the lock screen cannot know what was
 * logged, and the takeover resolves that live when it opens.
 */
function alarmTitle(section: HabitSection, habits: Habit[], fireDate: string): string {
  const first = dueRoutineHabits(section.id, habits, fireDate)[0];
  return first ? `${section.name} · ${first.name} first` : section.name;
}

/**
 * One alarm per distinct start time of every routine that has one. A routine
 * whose switch is off contributes nothing, but keeps its rows.
 */
export function planRoutineAlarms(
  sections: HabitSection[],
  habits: Habit[],
  now: Date
): RoutineAlarm[] {
  const alarms: RoutineAlarm[] = [];

  for (const section of sections) {
    if (!section.alarmEnabled) continue;

    const byTime = new Map<string, HabitWeekday[]>();
    for (const weekday of HABIT_WEEKDAYS) {
      const time = section.alarmByDay[weekday];
      if (!time) continue;
      const days = byTime.get(time);
      if (days) days.push(weekday);
      else byTime.set(time, [weekday]);
    }

    // Sorted so an unchanged week always produces the same ids, whatever order
    // the rows came back in.
    const times = [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b));

    times.forEach(([time, weekdays], index) => {
      const fireDate = nextFireDate(now, weekdays, time);
      if (!fireDate) return;

      const { hour, minute } = getHourMinute(time);
      alarms.push({
        id: alarmId(section.id, index),
        sectionId: section.id,
        title: alarmTitle(section, habits, fireDate),
        hour,
        minute,
        weekdays,
      });
    });
  }

  return alarms;
}

/**
 * Granted once, granted for the session — the same shape habit reminders use.
 * A grant given in Settings mid-session is picked up on the next launch, which
 * is when the sheet asks again anyway.
 */
let authorized = false;

/** Serialises `replaceAll`; see syncRoutineAlarms. */
let queue: Promise<void> = Promise.resolve();

/**
 * Replace every scheduled routine alarm with the set the sections imply.
 * Authorization is only asked for once there is something to schedule.
 */
export function syncRoutineAlarms(
  sections: HabitSection[],
  habits: Habit[],
  now: Date
): Promise<void> {
  if (!RoutineAlarms.isAvailable) return Promise.resolve();

  // Queued, never concurrent. `replaceAll` cancels everything before it
  // schedules anything, so two passes overlapping can end with the older plan
  // written last — or with AlarmKit rejecting a duplicate id mid-loop and half
  // the alarms missing.
  queue = queue.then(async () => {
    try {
      const planned = planRoutineAlarms(sections, habits, now);

      if (planned.length > 0 && !authorized) {
        authorized = (await RoutineAlarms.requestAuthorization()) === 'authorized';
        if (!authorized) return;
      }

      await RoutineAlarms.replaceAll(planned);
    } catch (error) {
      console.error('Failed to sync routine alarms:', error);
      Sentry.captureException(error, { tags: { feature: 'routine_alarms' } });
    }
  });

  return queue;
}
