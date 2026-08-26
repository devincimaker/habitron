import type { DayReviewSummary, JournalEntry } from '@habits-coach/shared';
import {
  buildTrendWindow,
  findGaps,
  formatChipLabel,
  formatDayTitle,
  formatRange,
  groupByDay,
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

describe('buildTrendWindow', () => {
  it('is fourteen days ending today, oldest first', () => {
    const window = buildTrendWindow([], '2026-08-25');
    expect(window).toHaveLength(14);
    expect(window[0].date).toBe('2026-08-12');
    expect(window[13].date).toBe('2026-08-25');
    expect(window[0].dayOfMonth).toBe(12);
  });

  it('attaches each day its review, and leaves the rest null', () => {
    const window = buildTrendWindow([review('2026-08-20', 4)], '2026-08-25');
    expect(window.find((d) => d.date === '2026-08-20')?.review?.overall).toBe(4);
    expect(window.find((d) => d.date === '2026-08-21')?.review).toBeNull();
  });

  // A review outside the window must not shift the columns or leak into one.
  it('ignores reviews from before the window', () => {
    const window = buildTrendWindow([review('2026-07-01')], '2026-08-25');
    expect(window.every((d) => d.review === null)).toBe(true);
  });

  it('crosses a month boundary', () => {
    const window = buildTrendWindow([], '2026-09-02');
    expect(window[0].date).toBe('2026-08-20');
  });
});

describe('findGaps', () => {
  it('names the days with no review', () => {
    const window = buildTrendWindow(
      [review('2026-08-24'), review('2026-08-25')],
      '2026-08-25',
      4
    );
    expect(findGaps(window)).toEqual(['2026-08-22', '2026-08-23']);
  });

  it('is empty when every day was reviewed', () => {
    const dates = ['2026-08-23', '2026-08-24', '2026-08-25'];
    expect(findGaps(buildTrendWindow(dates.map((d) => review(d)), '2026-08-25', 3))).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('gives a reviewed day a row even with no entries', () => {
    const groups = groupByDay([review('2026-08-24', 4)], [], '2026-08-25');
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toEqual([]);
    expect(groups[0].title).toBe('Yesterday');
  });

  it('gives a day with entries a row even with no review', () => {
    const groups = groupByDay([], [entry('a', '2026-08-25')], '2026-08-25');
    expect(groups[0].review).toBeNull();
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[0].title).toBe('Today');
  });

  it('puts a review and its entries in one row, newest day first', () => {
    const groups = groupByDay(
      [review('2026-08-23'), review('2026-08-25', 5)],
      [entry('a', '2026-08-25'), entry('b', '2026-08-25'), entry('c', '2026-08-21')],
      '2026-08-25'
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-08-25', '2026-08-23', '2026-08-21']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[0].review?.overall).toBe(5);
    expect(groups[2].review).toBeNull();
  });
});

describe('labels', () => {
  it('names today and yesterday, then the weekday', () => {
    expect(formatDayTitle('2026-08-25', '2026-08-25')).toBe('Today');
    expect(formatDayTitle('2026-08-24', '2026-08-25')).toBe('Yesterday');
    expect(formatDayTitle('2026-08-22', '2026-08-25')).toContain('Aug');
  });

  it('keeps a chip short, weekday before the day, in any locale', () => {
    const label = formatChipLabel('2026-08-22');
    expect(label.endsWith(' 22')).toBe(true);
    expect(label.slice(0, -3).trim().length).toBeGreaterThan(0);
  });

  it('names the month once when the range stays inside it', () => {
    expect(formatRange('2026-08-12', '2026-08-25')).toBe('Aug 12 – 25');
  });

  it('names both months when the range crosses one', () => {
    expect(formatRange('2026-07-30', '2026-08-12')).toBe('Jul 30 – Aug 12');
  });
});
