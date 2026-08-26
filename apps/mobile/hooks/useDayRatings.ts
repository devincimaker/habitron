import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatMessage, SessionOpener } from '@habits-coach/shared';
import { useRitualsStore } from '../stores/useRitualsStore';
import {
  composeRatingsMessage,
  parseCoachRatings,
  type DayRatings,
  type RatingAxis,
} from '../utils/dayRatings';

interface UseDayRatingsArgs {
  opener: SessionOpener;
  ritualDate: string | null;
  messages: Pick<ChatMessage, 'role' | 'content'>[];
}

interface UseDayRatings {
  /** Whether the card belongs on screen at all. */
  visible: boolean;
  ratings: DayRatings;
  /** True when the values came from the coach's reading rather than taps. */
  prefilled: boolean;
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
export function useDayRatings({
  opener,
  ritualDate,
  messages,
}: UseDayRatingsArgs): UseDayRatings {
  const isRitual = opener === 'review-day';
  // Selectors, so an unrelated store write does not re-render the session.
  const load = useRitualsStore((state) => state.load);
  const reviews = useRitualsStore((state) => state.reviews);

  const [taps, setTaps] = useState<DayRatings>({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isRitual) void load();
  }, [isRitual, load]);

  // The coach prints its scale whenever it shows a review, which is how the
  // card pre-fills itself from a day that was spoken rather than tapped.
  const heard = useMemo(() => {
    if (!isRitual) return null;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    return lastAssistant ? parseCoachRatings(lastAssistant.content) : null;
  }, [isRitual, messages]);

  // A tap always wins over the reading it is correcting.
  const ratings = useMemo(() => ({ ...heard, ...taps }), [heard, taps]);

  const setRating = useCallback((axis: RatingAxis, value: number) => {
    setTaps((current) => ({ ...current, [axis]: value }));
  }, []);

  const markSent = useCallback(() => setSent(true), []);

  // An all-hollow scale is the coach showing an unrated day, not a reading of
  // one — captioning that "from what you said" would be a lie.
  const heardAnything = heard !== null && Object.keys(heard).length > 0;
  const reviewed = reviews.some((review) => review.reviewDate === ritualDate);

  return {
    visible: isRitual && !sent && !reviewed,
    ratings,
    prefilled: heardAnything && Object.keys(taps).length === 0,
    setRating,
    message: composeRatingsMessage(ratings),
    markSent,
  };
}
