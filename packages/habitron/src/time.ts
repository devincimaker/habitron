import type { HabitWeekday } from '@habits-coach/shared';

// Sunday-first, matching HABIT_WEEKDAYS in @habits-coach/shared (type-only import:
// the shared package is CJS, so its runtime values are not visible from ESM).
const WEEKDAYS: readonly HabitWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Seconds are optional and ignored. The canonical form is minute-granular, but
// models reach for `:00` seconds often enough that rejecting it only buys a
// failed tool call and a retry. The `T` is still required: a space separator
// stays a rejection, so the shape remains unambiguous.
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

export function isIsoDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Local wall clock, `YYYY-MM-DDTHH:MM`. No zone: it means "as read on a clock there". */
export function isIsoDateTime(value: string): boolean {
  return DATE_TIME_RE.test(value) && !Number.isNaN(Date.parse(`${toMinute(value)}:00Z`));
}

/** `YYYY-MM-DDTHH:MM[:SS]` down to the minute — the granularity this field means. */
function toMinute(dateTime: string): string {
  return dateTime.slice(0, 16);
}

interface LocalParts {
  date: string;
  time: string;
  seconds: string;
}

// Building an Intl.DateTimeFormat is the expensive part, and the history
// builders read a local date once per task. One formatter per timezone.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** What a clock in `timezone` reads at `instant`. */
function localPartsAt(instant: Date, timezone: string): LocalParts {
  const parts = formatterFor(timezone).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // Intl can render midnight as hour 24 in some locales/zones.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
    seconds: get('second'),
  };
}

/**
 * How far ahead of UTC `timezone` is at `instant`, in milliseconds. Derived by
 * reading the local clock and re-parsing it as if it were UTC, so it needs no
 * offset table and follows DST wherever Intl does.
 */
function zoneOffsetMs(instant: Date, timezone: string): number {
  const { date, time, seconds } = localPartsAt(instant, timezone);
  return Date.parse(`${date}T${time}:${seconds}Z`) - instant.getTime();
}

/** The `YYYY-MM-DD` an instant falls on in `timezone`, not in UTC. */
export function localDateOf(instant: string, timezone: string): string {
  return localPartsAt(new Date(instant), timezone).date;
}

/**
 * A local wall clock (`YYYY-MM-DDTHH:MM`) as a UTC instant.
 *
 * Two passes, because the offset that applies is the one at the *result*, not
 * the one at the naive reading: on a DST boundary those differ by an hour, and
 * the first pass can land on the wrong side of it.
 */
export function instantFrom(dateTime: string, timezone: string): string {
  const naive = Date.parse(`${toMinute(dateTime)}:00Z`);
  const firstPass = naive - zoneOffsetMs(new Date(naive), timezone);
  return new Date(naive - zoneOffsetMs(new Date(firstPass), timezone)).toISOString();
}

export interface LocalNow {
  date: string;
  time: string;
  weekday: HabitWeekday;
}

/** Local wall-clock "now" in the given IANA timezone. */
export function localNow(timezone: string): LocalNow {
  const { date, time } = localPartsAt(new Date(), timezone);
  return { date, time, weekday: weekdayOf(date) };
}

export function today(timezone: string): string {
  return localNow(timezone).date;
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
