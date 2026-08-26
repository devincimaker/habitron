import type { DayReviewSummary, JournalEntry } from '@habits-coach/shared';

/** The four axes the strip plots, in row order. `overall` is the verdict, not a row. */
export const TREND_AXES = ['happy', 'energy', 'momentum', 'calm'] as const;

export type TrendAxis = (typeof TREND_AXES)[number];

export const AXIS_LABELS: Record<TrendAxis, string> = {
  happy: 'Happy',
  energy: 'Energy',
  momentum: 'Momentum',
  calm: 'Calm',
};

/** One ramp of words for all four axes, matching what the coach prints. */
const RATING_WORDS = ['bad', 'low', 'ok', 'good', 'great'];

export function ratingWord(value: number | undefined): string | null {
  return value ? (RATING_WORDS[value - 1] ?? null) : null;
}

/** Two weeks — long enough to read a run, short enough that a column stays legible. */
const TREND_DAYS = 14;

export interface TrendDay {
  date: string;
  /** Day of the month, the label under the column. */
  dayOfMonth: number;
  review: DayReviewSummary | null;
}

/** A day the list shows: a review, some entries, or both. Never neither. */
export interface DayGroup {
  date: string;
  title: string;
  review: DayReviewSummary | null;
  entries: JournalEntry[];
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Noon, so a date-only string never lands on the wrong day through a timezone. */
function parseDayDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

/** `Today`, `Yesterday`, or the full weekday and date. */
export function formatDayTitle(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(parseDayDate(date));
}

/** The short form the gap chips use: `Sat 16`. */
export function formatChipLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
  }).format(parseDayDate(date));
}

/** `Aug 12 – 25`, the range under the strip. */
export function formatRange(start: string, end: string): string {
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const first = parseDayDate(start);
  const last = parseDayDate(end);
  const tail =
    first.getMonth() === last.getMonth()
      ? `${last.getDate()}`
      : `${month.format(last)} ${last.getDate()}`;
  return `${month.format(first)} ${first.getDate()} – ${tail}`;
}

/**
 * The `TREND_DAYS` columns ending today, oldest first — every day, reviewed or
 * not, because an unreviewed day is a gap in the strip rather than a missing
 * column.
 */
export function buildTrendWindow(
  reviews: DayReviewSummary[],
  today: string,
  days = TREND_DAYS
): TrendDay[] {
  const byDate = new Map(reviews.map((review) => [review.reviewDate, review]));

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return {
      date,
      dayOfMonth: parseDayDate(date).getDate(),
      review: byDate.get(date) ?? null,
    };
  });
}

/** The days in the window with no review — what the chips offer to fill in. */
export function findGaps(window: TrendDay[]): string[] {
  return window.filter((day) => day.review === null).map((day) => day.date);
}

/**
 * The list, grouped by **day** rather than by entry: a reviewed day is a row
 * even with nothing written on it, and a day with entries is a row even if it
 * was never reviewed.
 */
export function groupByDay(
  reviews: DayReviewSummary[],
  entries: JournalEntry[],
  today: string
): DayGroup[] {
  const byDate = new Map<string, DayGroup>();

  const ensure = (date: string): DayGroup => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const group: DayGroup = { date, title: formatDayTitle(date, today), review: null, entries: [] };
    byDate.set(date, group);
    return group;
  };

  for (const review of reviews) ensure(review.reviewDate).review = review;
  for (const entry of entries) ensure(entry.entryDate).entries.push(entry);

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
