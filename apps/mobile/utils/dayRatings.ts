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

const AXIS_BY_LABEL = new Map<string, RatingAxis>(
  RATING_AXES.map((axis) => [AXIS_LABELS[axis].toLowerCase(), axis])
);

const FILLED = '●';
const HOLLOW = '○';

/**
 * The coach's rendered scale, read back into values.
 *
 * `review-day` prints a row per axis — `Happy      ○ ○ ● ○ ○   ok` — whenever it
 * shows a review, which is the only channel the card has for pre-filling itself
 * from what was said out loud. The value is the **last** filled position, so a
 * single marker reads as its position and a filled bar reads as its length.
 *
 * Returns null when the text carries no scale at all, so a caller can tell "the
 * coach said nothing about ratings" from "the coach showed an unrated day".
 */
export function parseCoachRatings(text: string): DayRatings | null {
  const ratings: DayRatings = {};
  let sawScale = false;

  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z]+)\s+([○●][○●\s]*)/.exec(line);
    if (!match) continue;

    const axis = AXIS_BY_LABEL.get(match[1].toLowerCase());
    if (!axis) continue;

    const dots = [...match[2]].filter((c) => c === FILLED || c === HOLLOW);
    if (dots.length === 0) continue;

    sawScale = true;
    const value = dots.lastIndexOf(FILLED) + 1;
    if (value > 0) ratings[axis] = value;
  }

  return sawScale ? ratings : null;
}
