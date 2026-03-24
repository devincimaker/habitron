import { supabase } from './supabase';
import type { Goal, GoalDraft, GoalStatus, Priority } from '@habits-coach/shared';

interface DbGoal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: Priority | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

function mapDbGoalToGoal(dbGoal: DbGoal): Goal {
  return {
    id: dbGoal.id,
    title: dbGoal.title,
    description: dbGoal.description ?? undefined,
    status: dbGoal.status,
    priority: dbGoal.priority ?? undefined,
    targetDate: dbGoal.target_date ?? undefined,
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
    .order('created_at', { ascending: true });

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
      description: goal.description ?? null,
      status: goal.status ?? 'active',
      priority: goal.priority ?? null,
      target_date: goal.targetDate ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding goal:', error);
    throw error;
  }

  return mapDbGoalToGoal(data as DbGoal);
}

export async function updateGoal(
  goalId: string,
  changes: Partial<GoalDraft>
): Promise<Goal> {
  const updateData: Partial<DbGoal> = {};

  if (changes.title !== undefined) updateData.title = changes.title;
  if (changes.description !== undefined) {
    updateData.description = changes.description ?? null;
  }
  if (changes.status !== undefined) updateData.status = changes.status;
  if (changes.priority !== undefined) {
    updateData.priority = changes.priority ?? null;
  }
  if (changes.targetDate !== undefined) {
    updateData.target_date = changes.targetDate ?? null;
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

export async function archiveGoal(goalId: string): Promise<Goal> {
  return updateGoal(goalId, { status: 'archived' });
}
