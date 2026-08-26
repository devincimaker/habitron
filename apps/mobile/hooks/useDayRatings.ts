import { useCallback, useEffect, useState } from 'react';
import type { SessionOpener } from '@habits-coach/shared';
import { useRitualsStore } from '../stores/useRitualsStore';
import { composeRatingsMessage, type DayRatings, type RatingAxis } from '../utils/dayRatings';

interface UseDayRatingsArgs {
  opener: SessionOpener;
  ritualDate: string | null;
}

interface UseDayRatings {
  /** Whether the card belongs on screen at all. */
  visible: boolean;
  ratings: DayRatings;
  setRating: (axis: RatingAxis, value: number) => void;
  /** The user message Send composes, empty while nothing is rated. */
  message: string;
  markSent: () => void;
}

/**
 * The rating card's state, and the one question of whether it is showing.
 *
 * It shows in a `review-day` session until the day has a review — the record,
 * not the conversation, because a session opened and closed again has to count
 * for nothing. Once ratings are sent it steps aside for the turn that saves
 * them, rather than waiting for the store to catch up.
 */
export function useDayRatings({ opener, ritualDate }: UseDayRatingsArgs): UseDayRatings {
  const isRitual = opener === 'review-day';
  // Selectors, so an unrelated store write does not re-render the session.
  const load = useRitualsStore((state) => state.load);
  const reviews = useRitualsStore((state) => state.reviews);

  const [ratings, setRatings] = useState<DayRatings>({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isRitual) void load();
  }, [isRitual, load]);

  const setRating = useCallback((axis: RatingAxis, value: number) => {
    setRatings((current) => ({ ...current, [axis]: value }));
  }, []);

  const markSent = useCallback(() => setSent(true), []);

  const reviewed = reviews.some((review) => review.reviewDate === ritualDate);

  return {
    visible: isRitual && !sent && !reviewed,
    ratings,
    setRating,
    message: composeRatingsMessage(ratings),
    markSent,
  };
}
