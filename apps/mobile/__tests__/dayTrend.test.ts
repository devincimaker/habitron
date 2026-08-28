import type { DayReviewSummary, JournalEntry } from '@habits-coach/shared';
import {
  formatChipLabel,
  formatDayTitle,
  groupByDay,
  recentReviews,
} from '../utils/dayTrend';

const review = (reviewDate: string, overall?: number): DayReviewSummary => ({
  reviewDate,
  happy: 3,
  energy: 2,
  momentum: 4,
  calm: 3,
  overall,
});

const entry = (id: string, entryDate: string): JournalEntry => ({
  id,
  entryDate,
  content: 'Something happened',
  source: 'manual',
  createdAt: 0,
  updatedAt: 0,
});

describe('recentReviews', () => {
  it('is the last thirty days, newest first', () => {
    const rail = recentReviews(
      [review('2026-08-25', 4), review('2026-08-01'), review('2026-08-20')],
      '2026-08-25'
    );
    expect(rail.map((r) => r.reviewDate)).toEqual(['2026-08-25', '2026-08-20', '2026-08-01']);
  });

  // The store holds 400 days for streaks; the rail must not be that.
  it('drops reviews older than the window', () => {
    const rail = recentReviews([review('2026-07-01'), review('2026-08-25')], '2026-08-25');
    expect(rail.map((r) => r.reviewDate)).toEqual(['2026-08-25']);
  });

  it('drops a review dated after today', () => {
    expect(recentReviews([review('2026-08-26')], '2026-08-25')).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('groups entries by their day, newest day first', () => {
    const groups = groupByDay(
      [entry('a', '2026-08-25'), entry('b', '2026-08-25'), entry('c', '2026-08-21')],
      '2026-08-25'
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-08-25', '2026-08-21']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[0].title).toBe('Today');
  });

  // A reviewed day with nothing written is reached through the rail now, so a
  // heading with no entries under it would be a row with nothing to show.
  it('gives no row to a day that has no entries', () => {
    expect(groupByDay([], '2026-08-25')).toEqual([]);
  });
});

describe('labels', () => {
  it('names today and yesterday, then the weekday', () => {
    expect(formatDayTitle('2026-08-25', '2026-08-25')).toBe('Today');
    expect(formatDayTitle('2026-08-24', '2026-08-25')).toBe('Yesterday');
    expect(formatDayTitle('2026-08-22', '2026-08-25')).toContain('Aug');
  });

  it('keeps a card head short, weekday before the day, in any locale', () => {
    const label = formatChipLabel('2026-08-22');
    expect(label.endsWith(' 22')).toBe(true);
    expect(label.slice(0, -3).trim().length).toBeGreaterThan(0);
  });
});
