import { formatVerdict } from './coachSessions';

/**
 * The five things a day is rated on, in card order. `overall` is the verdict
 * rather than a fifth axis, which is why it sits below a divider and takes the
 * verdict's own words.
 */
export const RATING_AXES = ['happy', 'energy', 'momentum', 'calm', 'overall'] as const;

export type RatingAxis = (typeof RATING_AXES)[number];
export type DayRatings = Partial<Record<RatingAxis, number>>;

export const AXIS_LABELS: Record<RatingAxis, string> = {
  happy: 'Happy',
  energy: 'Energy',
  momentum: 'Momentum',
  calm: 'Calm',
  overall: 'Overall',
};

/** One ramp for all four axes, the same words the coach prints beside its dots. */
const RATING_WORDS = ['bad', 'low', 'ok', 'good', 'great'];

/** The word shown at the right of a row, or null while the axis is unrated. */
export function ratingWord(axis: RatingAxis, value: number | undefined): string | null {
  if (!value) return null;
  if (axis === 'overall') return formatVerdict(value);
  return RATING_WORDS[value - 1] ?? null;
}

/**
 * What Send puts in the composer. The card is a keyboard, not a data path: this
 * goes through the ordinary turn and the coach calls `save_day_review` itself.
 */
export function composeRatingsMessage(ratings: DayRatings): string {
  return RATING_AXES.filter((axis) => ratings[axis])
    .map((axis) => `${axis} ${ratings[axis]}`)
    .join(', ');
}
