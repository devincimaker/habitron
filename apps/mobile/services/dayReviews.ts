import { supabase } from './supabase';
import type { DayReviewSummary } from '@habits-coach/shared';

interface DbDayReview {
  review_date: string;
  overall: number | null;
  happy: number | null;
  energy: number | null;
  momentum: number | null;
  calm: number | null;
}

function mapDbDayReview(row: DbDayReview): DayReviewSummary {
  return {
    reviewDate: row.review_date,
    overall: row.overall ?? undefined,
    happy: row.happy ?? undefined,
    energy: row.energy ?? undefined,
    momentum: row.momentum ?? undefined,
    calm: row.calm ?? undefined,
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Reviews from `start` (inclusive) to today. The window only has to be long
 * enough to measure a streak — the coach owns the analysis (`get_day_review_history`).
 */
export async function getDayReviews(start: string): Promise<DayReviewSummary[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('day_reviews')
    .select('review_date, overall, happy, energy, momentum, calm')
    .eq('user_id', userId)
    .gte('review_date', start)
    .order('review_date', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as DbDayReview[]).map(mapDbDayReview);
}

/** The dates with an accepted plan, which is what "planned that day" means. */
export async function getAcceptedPlanDates(start: string): Promise<string[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('daily_plans')
    .select('plan_date')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .gte('plan_date', start);

  if (error) throw error;
  return [...new Set(((data ?? []) as { plan_date: string }[]).map((row) => row.plan_date))];
}
