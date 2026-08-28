import { HABIT_WEEKDAYS, type HabitSection } from '@habits-coach/shared';
import { formatReminderTime, getHourMinute } from './habitTime';

export interface RoutineAlarmLabel {
  text: string;
  /** Only a routine that will actually ring gets the filled chip. */
  active: boolean;
}

/**
 * What the routine header's chip says: the next ring's time when the alarm is
 * on, `Paused` when the week is kept but switched off, `No alarm` when there is
 * no week to keep.
 */
export function getRoutineAlarmLabel(section: HabitSection, now: Date): RoutineAlarmLabel {
  const days = HABIT_WEEKDAYS.filter((weekday) => section.alarmByDay[weekday]);

  if (days.length === 0) return { text: 'No alarm', active: false };
  if (!section.alarmEnabled) return { text: 'Paused', active: false };

  const time = nextRingTime(section, now);
  return { text: time ? formatReminderTime(time) : 'No alarm', active: Boolean(time) };
}

/** HH:MM of the next ring at or after `now`, searching today then the week ahead. */
function nextRingTime(section: HabitSection, now: Date): string | undefined {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 8; offset++) {
    const weekday = HABIT_WEEKDAYS[(now.getDay() + offset) % 7];
    const time = section.alarmByDay[weekday];
    if (!time) continue;

    // Today's ring only counts if it has not already passed; a week later it
    // does, which is what the eighth iteration is for.
    if (offset === 0) {
      const { hour, minute } = getHourMinute(time);
      if (hour * 60 + minute <= nowMinutes) continue;
    }

    return time;
  }

  return undefined;
}
