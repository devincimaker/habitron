import { describe, expect, it } from 'vitest';
import { reviewPatch, reviewStreak, summariseReviews } from './dayReview.js';
import type { DayReviewRecord } from './db.js';

function review(reviewDate: string, axes: Partial<DayReviewRecord> = {}): DayReviewRecord {
  return { id: reviewDate, reviewDate, depth: 'quick', reviewedAt: `${reviewDate}T21:00:00Z`, ...axes };
}

describe('reviewStreak', () => {
  it('is zero with no reviews', () => {
    expect(reviewStreak([], '2026-08-25')).toEqual({ current: 0, longest: 0 });
  });

  it('counts consecutive days ending today', () => {
    const dates = ['2026-08-23', '2026-08-24', '2026-08-25'];
    expect(reviewStreak(dates, '2026-08-25')).toEqual({
      current: 3,
      longest: 3,
      lastReviewed: '2026-08-25',
    });
  });

  // The grace rule: the day is not over yet, so a missing today does not break
  // what yesterday earned. Wider than the habit one in computeStreaks, which
  // graces only today — hence two functions rather than one.
  it('survives today being unreviewed', () => {
    const dates = ['2026-08-23', '2026-08-24'];
    expect(reviewStreak(dates, '2026-08-25')).toMatchObject({ current: 2, longest: 2 });
  });

  it('breaks when yesterday is missing too', () => {
    const dates = ['2026-08-22', '2026-08-23'];
    expect(reviewStreak(dates, '2026-08-25')).toMatchObject({ current: 0, longest: 2 });
  });

  it('keeps the longest run after a gap resets the current one', () => {
    const dates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-24', '2026-08-25'];
    expect(reviewStreak(dates, '2026-08-25')).toMatchObject({ current: 2, longest: 4 });
  });

  // Backfilled reviews count (HAB-83): a review written for a past date repairs
  // the run rather than starting a second one.
  it('repairs a run when the missing day is backfilled', () => {
    const broken = ['2026-08-23', '2026-08-25'];
    expect(reviewStreak(broken, '2026-08-25')).toMatchObject({ current: 1, longest: 1 });
    expect(reviewStreak([...broken, '2026-08-24'], '2026-08-25')).toMatchObject({
      current: 3,
      longest: 3,
    });
  });

  it('is unmoved by a date reviewed twice', () => {
    const dates = ['2026-08-24', '2026-08-24', '2026-08-25'];
    expect(reviewStreak(dates, '2026-08-25')).toMatchObject({ current: 2, longest: 2 });
  });

  it('does not read a future-dated review as a current streak', () => {
    expect(reviewStreak(['2026-08-27'], '2026-08-25')).toMatchObject({ current: 0, longest: 1 });
  });
});

describe('summariseReviews', () => {
  const window = { start: '2026-08-22', end: '2026-08-25', days: 4 };

  it('averages each axis over the days that rated it', () => {
    const summary = summariseReviews(
      [review('2026-08-24', { happy: 4, energy: 2 }), review('2026-08-25', { happy: 5, energy: 4 })],
      window,
      '2026-08-25'
    );

    expect(summary.axes.happy).toMatchObject({ average: 4.5, rated: 2 });
    expect(summary.axes.energy).toMatchObject({ average: 3, rated: 2 });
  });

  // The whole point of NULL meaning "not asked": an unrated axis must not drag
  // an average down, and must not read as a zero.
  it('ignores unrated axes rather than counting them', () => {
    const summary = summariseReviews(
      [review('2026-08-24', { happy: 5 }), review('2026-08-25', {})],
      window,
      '2026-08-25'
    );

    expect(summary.axes.happy).toMatchObject({ average: 5, rated: 1 });
    expect(summary.axes.calm).toMatchObject({ average: null, rated: 0 });
  });

  it('splits the window in half for the trend', () => {
    const summary = summariseReviews(
      [
        review('2026-08-22', { momentum: 2 }),
        review('2026-08-23', { momentum: 2 }),
        review('2026-08-24', { momentum: 5 }),
        review('2026-08-25', { momentum: 5 }),
      ],
      window,
      '2026-08-25'
    );

    expect(summary.axes.momentum.trend).toEqual({ firstHalf: 2, secondHalf: 5 });
  });

  it('reports how much of the window was reviewed at all', () => {
    const summary = summariseReviews([review('2026-08-25', { overall: 4 })], window, '2026-08-25');

    expect(summary.reviewed).toBe(1);
    expect(summary.reviewedRate).toBe(0.25);
    expect(summary.streak.current).toBe(1);
  });
});

describe('reviewPatch', () => {
  const existing = (depth: DayReviewRecord['depth'], happy?: number): DayReviewRecord => ({
    id: 'review-1',
    reviewDate: '2026-08-25',
    depth,
    reviewedAt: '2026-08-25T21:00:00Z',
    ...(happy === undefined ? {} : { happy }),
  });

  it('writes only the fields the call passed', () => {
    expect(reviewPatch(null, { happy: 4, overall: 3, depth: 'quick' })).toEqual({
      happy: 4,
      overall: 3,
      depth: 'quick',
    });
  });

  it('leaves an axis the user skipped absent, rather than null or 3', () => {
    const patch = reviewPatch(null, { happy: 4 });

    expect(Object.keys(patch)).toEqual(['happy']);
  });

  it('lets a later beat add fields without touching the first beat’s', () => {
    const patch = reviewPatch(existing('quick', 4), {
      highlight: 'Shipped the migration',
      friction: 'Lost an hour to the seed script',
      depth: 'standard',
    });

    expect(patch).toEqual({
      highlight: 'Shipped the migration',
      friction: 'Lost an hour to the seed script',
      depth: 'standard',
    });
    expect(Object.keys(patch)).not.toContain('happy');
  });

  it('deepens quick to standard, and standard to deep', () => {
    expect(reviewPatch(existing('quick'), { depth: 'standard' }).depth).toBe('standard');
    expect(reviewPatch(existing('standard'), { depth: 'deep' }).depth).toBe('deep');
  });

  // A second visit that stops after the ratings must not demote a review that
  // already reached the open lane.
  it('never demotes deep back to quick', () => {
    const patch = reviewPatch(existing('deep'), { happy: 5, depth: 'quick' });

    expect(patch).toEqual({ happy: 5 });
  });

  it('writes depth on a brand new row even at the floor', () => {
    expect(reviewPatch(null, { depth: 'quick' })).toEqual({ depth: 'quick' });
  });

  it('is empty when the call passes nothing, so the caller can skip the write', () => {
    expect(reviewPatch(existing('standard', 4), {})).toEqual({});
  });

  // An explicit empty string is a value the user gave — clearing a highlight is
  // a real edit, and only `undefined` means "leave it alone".
  it('treats an empty string as a value, not as absent', () => {
    expect(reviewPatch(existing('standard'), { highlight: '' })).toEqual({ highlight: '' });
  });
});

describe('summariseReviews streak lookback', () => {
  const window = { start: '2026-08-22', end: '2026-08-25', days: 4 };

  // The averages belong to the window; a streak does not. A 4-day window asking
  // for "the current streak" must not answer 4 when the real run is 8.
  it('measures the streak from the wider set, not the window', () => {
    const inWindow = ['2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25'].map((d) => review(d));
    const earlier = ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'].map((d) => review(d));

    const truncated = summariseReviews(inWindow, window, '2026-08-25');
    const full = summariseReviews(inWindow, window, '2026-08-25', [...earlier, ...inWindow]);

    expect(truncated.streak.current).toBe(4);
    expect(full.streak.current).toBe(8);
    // The window-scoped numbers are untouched by the wider set.
    expect(full.reviewed).toBe(4);
    expect(full.reviewedRate).toBe(1);
  });
});
