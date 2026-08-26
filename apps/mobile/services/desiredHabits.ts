import { supabase } from './supabase';
import type { DesiredHabit, DesiredHabitDraft } from '@habits-coach/shared';

interface DbDesiredHabit {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  habit_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapDbDesiredHabit(row: DbDesiredHabit): DesiredHabit {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? undefined,
    habitId: row.habit_id ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/** Oldest first: the list has no ordering of its own, so `created_at` is it. */
export async function getDesiredHabits(): Promise<DesiredHabit[]> {
  const { data, error } = await supabase
    .from('desired_habits')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching desired habits:', error);
    throw error;
  }

  return (data as DbDesiredHabit[]).map(mapDbDesiredHabit);
}

export async function addDesiredHabit(draft: DesiredHabitDraft): Promise<DesiredHabit> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('desired_habits')
    .insert({
      user_id: user.id,
      title: draft.title,
      note: draft.note ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding desired habit:', error);
    throw error;
  }

  return mapDbDesiredHabit(data as DbDesiredHabit);
}

/** `habitId: null` clears the stand-in habit; omitting it leaves the link alone. */
export async function updateDesiredHabit(
  id: string,
  updates: { title?: string; note?: string; habitId?: string | null }
): Promise<void> {
  const payload: Partial<DbDesiredHabit> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.note !== undefined) payload.note = updates.note || null;
  if (updates.habitId !== undefined) payload.habit_id = updates.habitId;

  const { error } = await supabase.from('desired_habits').update(payload).eq('id', id);

  if (error) {
    console.error('Error updating desired habit:', error);
    throw error;
  }
}

export async function removeDesiredHabit(id: string): Promise<void> {
  const { error } = await supabase.from('desired_habits').delete().eq('id', id);

  if (error) {
    console.error('Error removing desired habit:', error);
    throw error;
  }
}
