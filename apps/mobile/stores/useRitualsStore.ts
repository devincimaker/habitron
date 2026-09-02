import { create } from 'zustand';
import type { DayReviewSummary } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import type { DayRitualId } from '../constants/rituals';
import * as dayReviewsService from '../services/dayReviews';
import { dateStreak, type DateStreak } from '../utils/streaks';

/**
 * How far back the cards look. Long enough that a streak worth protecting is
 * never truncated, short enough to stay one small query per ritual.
 */
const LOOKBACK_DAYS = 400;

// Off the app's local today, so the store and the cards speak one calendar.
function daysAgo(days: number): string {
  const d = new Date(`${getTodayDate()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export interface RitualState {
  /** Whether the ritual's own record exists for the date — never "a session happened". */
  doneOnDate: boolean;
  streak: DateStreak;
}

interface RitualsState {
  planDates: string[];
  reviews: DayReviewSummary[];
  hasLoaded: boolean;
  isLoading: boolean;

  load: () => Promise<void>;
  ritualState: (ritual: DayRitualId, date: string) => RitualState;
  reviewFor: (date: string) => DayReviewSummary | null;
  clear: () => void;
}

export const useRitualsStore = create<RitualsState>((set, get) => ({
  planDates: [],
  reviews: [],
  hasLoaded: false,
  isLoading: false,

  load: async () => {
    if (!get().hasLoaded) set({ isLoading: true });
    const start = daysAgo(LOOKBACK_DAYS);
    try {
      const [planDates, reviews] = await Promise.all([
        dayReviewsService.getAcceptedPlanDates(start),
        dayReviewsService.getDayReviews(start),
      ]);
      set({ planDates, reviews, hasLoaded: true, isLoading: false });
    } catch (error) {
      console.warn('Failed to load ritual state:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Done is derived from the ritual's own table, never from a session existing:
   * opening a session and closing it again has to count for nothing.
   */
  ritualState: (ritual, date) => {
    const dates =
      ritual === 'plan-day' ? get().planDates : get().reviews.map((r) => r.reviewDate);
    return { doneOnDate: dates.includes(date), streak: dateStreak(dates, date) };
  },

  reviewFor: (date) => get().reviews.find((r) => r.reviewDate === date) ?? null,

  clear: () => set({ planDates: [], reviews: [], hasLoaded: false }),
}));
