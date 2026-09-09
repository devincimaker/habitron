import type { TaskRepeatRule } from '@habits-coach/shared';
import { formatShortDate, getNextDay, toDateString } from './dateUtils';

/** How far ahead occurrences exist: eight weeks, refreshed on every load. */
const REPEAT_WINDOW_DAYS = 56;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

function parseDate(date: string): Date {
  return new Date(date + 'T00:00:00');
}

function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  parsed.setDate(parsed.getDate() + days);
  return toDateString(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

/** 0 = Sunday … 6 = Saturday, the numbering the rule stores. */
export function getWeekday(date: string): number {
  return parseDate(date).getDay();
}

export function getRepeatHorizon(today: string): string {
  return addDays(today, REPEAT_WINDOW_DAYS);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Whether `date` is an occurrence of a rule anchored on `startDate`. Mirrors
 * `task_series_dates` in the database: biweekly counts Sunday-based weeks from
 * the start date's week, monthly clamps the start day to shorter months.
 */
export function matchesRepeatRule(rule: TaskRepeatRule, startDate: string, date: string): boolean {
  if (date < startDate || (rule.endDate && date > rule.endDate)) return false;
  const parsed = parseDate(date);

  switch (rule.frequency) {
    case 'weekly':
      return rule.weekdays.includes(parsed.getDay());
    case 'biweekly': {
      if (!rule.weekdays.includes(parsed.getDay())) return false;
      const startWeek = addDays(startDate, -getWeekday(startDate));
      return Math.floor(daysBetween(startWeek, date) / 7) % 2 === 0;
    }
    case 'monthly':
      return parsed.getDate() === Math.min(parseDate(startDate).getDate(), daysInMonth(parsed));
  }
}

/** The first date on or after `from` the rule falls on, if any within a year. */
export function nextRepeatDate(rule: TaskRepeatRule, from: string): string | undefined {
  let date = from;
  for (let step = 0; step <= 366; step += 1) {
    if (matchesRepeatRule(rule, from, date)) return date;
    date = getNextDay(date);
  }
  return undefined;
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day));
}

function listWeekdays(weekdays: number[], long: boolean): string {
  const names = [...weekdays].sort().map((day) => (long ? WEEKDAY_NAMES : WEEKDAY_SHORT)[day]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function ordinal(day: number): string {
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][day % 10] ?? 'th');
  return `${day}${suffix}`;
}

/**
 * The rule in words: "Every Wednesday", "Every Mon and Wed", "Every weekday",
 * "Every 2 weeks on Wednesday", "Monthly on the 9th". `anchorDate` names the
 * day of month a monthly rule repeats on; the end date is appended when set.
 */
export function describeTaskRepeat(rule: TaskRepeatRule, anchorDate?: string): string {
  let label: string;
  switch (rule.frequency) {
    case 'weekly':
      label = sameDays(rule.weekdays, EVERY_DAY)
        ? 'Every day'
        : sameDays(rule.weekdays, WEEKDAYS_ONLY)
          ? 'Every weekday'
          : `Every ${listWeekdays(rule.weekdays, rule.weekdays.length === 1)}`;
      break;
    case 'biweekly':
      label = `Every 2 weeks on ${listWeekdays(rule.weekdays, rule.weekdays.length === 1)}`;
      break;
    case 'monthly':
      label = anchorDate ? `Monthly on the ${ordinal(parseDate(anchorDate).getDate())}` : 'Monthly';
      break;
  }
  return rule.endDate ? `${label} until ${formatShortDate(rule.endDate)}` : label;
}

/** The change set keys whose edit is "the series from this one on", not this one. */
const SERIES_FIELDS = [
  'title',
  'notes',
  'priority',
  'estimateMinutes',
  'goalId',
  'tagId',
  'tagName',
  'listId',
  'listName',
  'checklist',
] as const;

/**
 * Whether an edit to one occurrence should be copied to its later siblings.
 * The date is always this one's alone; the time follows the series unless it
 * came with a date move, which is how the schedule pickers send it.
 */
export function changesPropagateToSeries(
  changes: Record<string, unknown>,
  currentScheduledDate: string | undefined
): boolean {
  if ('repeat' in changes) return false;
  if (SERIES_FIELDS.some((key) => key in changes)) return true;
  return (
    'scheduledTime' in changes &&
    (!('scheduledDate' in changes) || changes.scheduledDate === currentScheduledDate)
  );
}
