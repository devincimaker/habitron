import type { HabitWeekday } from '@habits-coach/shared';
import { config } from './config.js';

// Sunday-first, matching HABIT_WEEKDAYS in @habits-coach/shared (type-only import:
// the shared package is CJS, so its runtime values are not visible from ESM).
const WEEKDAYS: readonly HabitWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Local wall-clock "now" in the configured timezone. */
export function localNow(): { date: string; time: string; weekday: HabitWeekday } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date, time: `${hour}:${get('minute')}`, weekday: weekdayOf(date) };
}

export function today(): string {
  return localNow().date;
}

export function weekdayOf(date: string): HabitWeekday {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sunday-based week containing `date`, matching HABIT_WEEKDAYS ordering. */
export function weekRange(date: string): { start: string; end: string } {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -dow);
  return { start, end: addDays(start, 6) };
}
