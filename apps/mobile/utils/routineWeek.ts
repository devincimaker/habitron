import { HABIT_WEEKDAYS, type HabitWeekday } from '@habits-coach/shared';
import { formatReminderTime } from './habitTime';

/** The week the switch seeds when it is turned on with nothing set. */
const DEFAULT_ALARM_TIME = '07:00';

export interface WeekSelectionSummary {
  /** "Mon – Fri", "Every day", "Mon, Wed, Sat"… */
  days: string;
  /** The shared time, or "Mixed" when the selected days disagree. */
  time: string;
}

/** Mon-first, because that is how the summary reads even though Sun starts the strip. */
const WEEK_ORDER: HabitWeekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Names a set of weekdays the way a person would: a run of three or more
 * becomes a range, and the two runs everyone has a word for get their word.
 */
function describeWeekdays(weekdays: HabitWeekday[]): string {
  const picked = WEEK_ORDER.filter((weekday) => weekdays.includes(weekday));
  if (picked.length === 0) return 'No days';
  if (picked.length === 7) return 'Every day';

  const isWeekend = picked.length === 2 && picked.includes('Sat') && picked.includes('Sun');
  if (isWeekend) return 'Sat – Sun';

  // A contiguous run reads better as a range than as a list. Mon – Fri needs no
  // case of its own: WEEK_ORDER starts on Monday, so it is one.
  const first = WEEK_ORDER.indexOf(picked[0]);
  const isRun = picked.every((day, offset) => WEEK_ORDER.indexOf(day) === first + offset);
  if (isRun && picked.length >= 3) return `${picked[0]} – ${picked[picked.length - 1]}`;

  return picked.join(', ');
}

export function summariseWeekSelection(
  selected: HabitWeekday[],
  alarmByDay: Partial<Record<HabitWeekday, string>>
): WeekSelectionSummary {
  const times = new Set(selected.flatMap((weekday) => alarmByDay[weekday] ?? []));

  if (times.size === 0) return { days: describeWeekdays(selected), time: 'Set a time' };
  if (times.size > 1) return { days: describeWeekdays(selected), time: 'Mixed' };

  return {
    days: describeWeekdays(selected),
    time: formatReminderTime([...times][0]),
  };
}

/** Every weekday, so turning the switch on never leaves the strip blank. */
export function seedWeek(): Partial<Record<HabitWeekday, string>> {
  return Object.fromEntries(HABIT_WEEKDAYS.map((weekday) => [weekday, DEFAULT_ALARM_TIME]));
}
