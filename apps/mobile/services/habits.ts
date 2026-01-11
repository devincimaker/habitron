import { supabase } from './supabase';
import { Habit, HabitStatus, getTodayDate } from '@habits-coach/shared';

// Database row types (snake_case from Supabase)
interface DbHabit {
  id: string;
  user_id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime' | null;
  reason: string | null;
  icon: string | null;
  created_at: string;
}

interface DbHabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  status: HabitStatus;
}

// Convert database row to app type
function mapDbHabitToHabit(dbHabit: DbHabit): Habit {
  return {
    id: dbHabit.id,
    name: dbHabit.name,
    frequency: dbHabit.frequency,
    timeOfDay: dbHabit.time_of_day ?? undefined,
    reason: dbHabit.reason ?? undefined,
    icon: dbHabit.icon ?? undefined,
    createdAt: new Date(dbHabit.created_at).getTime(),
  };
}

// Habits CRUD
export async function getHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching habits:', error);
    throw error;
  }

  return (data as DbHabit[]).map(mapDbHabitToHabit);
}

export async function addHabit(
  habit: Omit<Habit, 'id' | 'createdAt'>
): Promise<Habit> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: user.id,
      name: habit.name,
      frequency: habit.frequency,
      time_of_day: habit.timeOfDay ?? null,
      reason: habit.reason ?? null,
      icon: habit.icon ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding habit:', error);
    throw error;
  }

  return mapDbHabitToHabit(data as DbHabit);
}

export async function removeHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', habitId);

  if (error) {
    console.error('Error removing habit:', error);
    throw error;
  }
}

export async function updateHabit(
  habitId: string,
  updates: Partial<Omit<Habit, 'id' | 'createdAt'>>
): Promise<void> {
  const updateData: Partial<DbHabit> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.timeOfDay !== undefined)
    updateData.time_of_day = updates.timeOfDay;
  if (updates.reason !== undefined) updateData.reason = updates.reason;
  if (updates.icon !== undefined) updateData.icon = updates.icon;

  const { error } = await supabase
    .from('habits')
    .update(updateData)
    .eq('id', habitId);

  if (error) {
    console.error('Error updating habit:', error);
    throw error;
  }
}

// Habit Logs
export async function getLogsForDate(date: string): Promise<Map<string, HabitStatus>> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, status')
    .eq('date', date);

  if (error) {
    console.error('Error fetching logs for date:', error);
    throw error;
  }

  const logsMap = new Map<string, HabitStatus>();
  for (const log of data as Pick<DbHabitLog, 'habit_id' | 'status'>[]) {
    logsMap.set(log.habit_id, log.status);
  }

  return logsMap;
}

export async function getTodayLogs(): Promise<Map<string, HabitStatus>> {
  return getLogsForDate(getTodayDate());
}

export async function setHabitStatus(
  habitId: string,
  date: string,
  status: HabitStatus
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase.from('habit_logs').upsert(
    {
      habit_id: habitId,
      user_id: user.id,
      date,
      status,
    },
    {
      onConflict: 'habit_id,date',
    }
  );

  if (error) {
    console.error('Error setting habit status:', error);
    throw error;
  }
}

// Re-export getTodayDate for convenience
export { getTodayDate };
