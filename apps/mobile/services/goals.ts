import { supabase } from './supabase';
import type { Goal, GoalDraft } from '@habits-coach/shared';

interface DbGoal {
  id: string;
  user_id: string;
  title: string;
  measure: string;
  target_date: string;
  completed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Everything the app writes: the draft, plus done, which the sheet toggles. */
export interface GoalChanges extends Partial<GoalDraft> {
  /** `null` reopens the goal. */
  completedAt?: number | null;
}

function mapDbGoalToGoal(dbGoal: DbGoal): Goal {
  return {
    id: dbGoal.id,
    title: dbGoal.title,
    measure: dbGoal.measure,
    targetDate: dbGoal.target_date,
    completedAt: dbGoal.completed_at ? new Date(dbGoal.completed_at).getTime() : undefined,
    reviewedAt: dbGoal.reviewed_at ? new Date(dbGoal.reviewed_at).getTime() : undefined,
    createdAt: new Date(dbGoal.created_at).getTime(),
    updatedAt: new Date(dbGoal.updated_at).getTime(),
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('target_date', { ascending: true });

  if (error) {
    console.error('Error fetching goals:', error);
    throw error;
  }

  return (data as DbGoal[]).map(mapDbGoalToGoal);
}

export async function addGoal(goal: GoalDraft): Promise<Goal> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      title: goal.title,
      measure: goal.measure,
      target_date: goal.targetDate,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding goal:', error);
    throw error;
  }

  return mapDbGoalToGoal(data as DbGoal);
}

export async function updateGoal(goalId: string, changes: GoalChanges): Promise<Goal> {
  const updateData: Partial<DbGoal> = {};

  if (changes.title !== undefined) updateData.title = changes.title;
  if (changes.measure !== undefined) updateData.measure = changes.measure;
  if (changes.targetDate !== undefined) updateData.target_date = changes.targetDate;
  if (changes.completedAt !== undefined) {
    updateData.completed_at =
      changes.completedAt === null ? null : new Date(changes.completedAt).toISOString();
  }

  const { data, error } = await supabase
    .from('goals')
    .update(updateData)
    .eq('id', goalId)
    .select()
    .single();

  if (error) {
    console.error('Error updating goal:', error);
    throw error;
  }

  return mapDbGoalToGoal(data as DbGoal);
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', goalId);

  if (error) {
    console.error('Error deleting goal:', error);
    throw error;
  }
}
