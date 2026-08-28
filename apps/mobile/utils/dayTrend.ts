import type { DayReviewSummary, JournalEntry } from '@habits-coach/shared';

/** The four axes a card plots, in row order. `overall` is the verdict, not a row. */
export const TREND_AXES = ['happy', 'energy', 'momentum', 'calm'] as const;

export type TrendAxis = (typeof TREND_AXES)[number];

export const AXIS_LABELS: Record<TrendAxis, string> = {
  happy: 'Happy',
  energy: 'Energy',
  momentum: 'Momentum',
  calm: 'Calm',
};

/** A month — long enough to read a run of days, short enough to scroll once. */
const RAIL_DAYS = 30;

/** A day the list shows: one or more entries written on it. */
export interface DayGroup {
  date: string;
  title: string;
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

// Built once. Constructing an Intl formatter is the expensive half of
// formatting, and a rail of thirty cards asks for two of these apiece.
const WEEKDAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const DAY_TITLE = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

/** `Today`, `Yesterday`, or the full weekday and date. */
export function formatDayTitle(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return DAY_TITLE.format(parseDayDate(date));
}

/**
 * The short form a feeling card heads with: `Sat 16`.
 *
 * Composed rather than formatted whole: asking Intl for `weekday + day` lets
 * the locale reorder them, and a card that reads `16 Sat` beside a rail of
 * others is one nobody parses at a glance.
 */
export function formatChipLabel(date: string): string {
  const day = parseDayDate(date);
  return `${WEEKDAY_SHORT.format(day)} ${day.getDate()}`;
}

/**
 * The list, grouped by **day** rather than by entry. Entries only: a day that
 * was reviewed but never written on is reached through its card in the rail,
 * not through a heading with nothing under it.
 */
export function groupByDay(entries: JournalEntry[], today: string): DayGroup[] {
  const byDate = new Map<string, DayGroup>();

  for (const entry of entries) {
    let group = byDate.get(entry.entryDate);
    if (!group) {
      group = { date: entry.entryDate, title: formatDayTitle(entry.entryDate, today), entries: [] };
      byDate.set(entry.entryDate, group);
    }
    group.entries.push(entry);
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The reviews the rail shows: the newest `days` of them, newest first. The
 * store holds 400 days for streaks; the rail is a month of feeling, not that.
 */
export function recentReviews(
  reviews: DayReviewSummary[],
  today: string,
  days = RAIL_DAYS
): DayReviewSummary[] {
  const earliest = addDays(today, -(days - 1));
  return reviews
    .filter((review) => review.reviewDate >= earliest && review.reviewDate <= today)
    .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
}
