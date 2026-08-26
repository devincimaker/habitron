import type { DayReviewInput, DayReviewRecord, ReviewDepth } from './db.js';
import { averageOf, round } from './numbers.js';
import { addDays, windowMidpoint } from './time.js';

/** The four axes plus the verdict, in the order the card asks for them. */
const REVIEW_AXES = ['happy', 'energy', 'momentum', 'calm', 'overall'] as const;

type ReviewAxis = (typeof REVIEW_AXES)[number];

/** Every column a beat may write, camel and snake being identical for all of them. */
const REVIEW_FIELDS = [...REVIEW_AXES, 'highlight', 'friction'] as const;

const DEPTH_ORDER: ReviewDepth[] = ['quick', 'standard', 'deep'];

export interface ReviewStreak {
  current: number;
  longest: number;
  lastReviewed?: string;
}

/**
 * Consecutive reviewed days. A missing *today* does not break the streak — the
 * day is not over — but a missing yesterday does.
 *
 * `computeStreaks` in `history.ts` gives habits a narrower grace (today only,
 * and only when today is the end of the window) and is schedule-aware, so the
 * two are deliberately separate rather than one parameterised loop. Changing the
 * grace here does not change it there.
 *
 * Exported because the Coach hub's ritual card is the same question (HAB-86) and
 * two definitions of "reviewed" would drift.
 */
export function reviewStreak(reviewDates: string[], today: string): ReviewStreak {
  const dates = [...new Set(reviewDates)].sort();
  if (dates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i += 1) {
    run = dates[i] === addDays(dates[i - 1], 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = dates[dates.length - 1];
  // `run` is the streak ending at `last`, and only counts as current if `last`
  // is today or yesterday. A future-dated review ends its own run, so anything
  // after today reads as no current streak rather than as the grace case.
  const current = last === today || last === addDays(today, -1) ? run : 0;

  return { current, longest, lastReviewed: last };
}

/**
 * The columns one call writes. Pure, because the merge rules are the whole of
 * what `save_day_review` promises and they are worth testing without a database:
 *
 * - only the fields passed are written, so each beat adds to the row and none of
 *   them can blank what an earlier one recorded;
 * - `depth` only ever moves deeper, so a second visit that stops after the
 *   ratings cannot demote a review that already reached the open lane.
 */
export function reviewPatch(
  current: DayReviewRecord | null,
  input: DayReviewInput
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of REVIEW_FIELDS) {
    if (input[field] !== undefined) patch[field] = input[field];
  }
  if (input.depth !== undefined) {
    const deeper = DEPTH_ORDER.indexOf(input.depth) >= DEPTH_ORDER.indexOf(current?.depth ?? 'quick');
    if (deeper) patch.depth = input.depth;
  }
  return patch;
}

/**
 * Per-axis averages and a first-half/second-half trend over the window, plus how
 * many of its days were reviewed at all. An unrated axis is absent rather than
 * zero: a day the user did not rate must never read as a bad one.
 */
export function summariseReviews(
  reviews: DayReviewRecord[],
  window: { start: string; end: string; days: number },
  today: string,
  /** Reviews reaching back past the window, so the streak is not truncated by it. */
  forStreak: DayReviewRecord[] = reviews
) {
  const midpoint = windowMidpoint(window.start, window.days);
  const firstHalf = reviews.filter((r) => r.reviewDate < midpoint);
  const secondHalf = reviews.filter((r) => r.reviewDate >= midpoint);

  const axisSummary = (axis: ReviewAxis) => {
    const rated = (rows: DayReviewRecord[]) =>
      rows.map((r) => r[axis]).filter((v): v is number => v !== undefined);
    const values = rated(reviews);
    return {
      average: averageOf(values),
      rated: values.length,
      trend: { firstHalf: averageOf(rated(firstHalf)), secondHalf: averageOf(rated(secondHalf)) },
    };
  };

  return {
    window,
    reviewed: reviews.length,
    reviewedRate: round(reviews.length / window.days),
    streak: reviewStreak(
      forStreak.map((r) => r.reviewDate),
      today
    ),
    axes: {
      happy: axisSummary('happy'),
      energy: axisSummary('energy'),
      momentum: axisSummary('momentum'),
      calm: axisSummary('calm'),
      overall: axisSummary('overall'),
    },
    reviews,
  };
}
