import { supabase } from './supabase';
import {
  Habit,
  HabitDraft,
  HabitStatus,
  HabitWeekday,
  getTodayDate,
} from '@habits-coach/shared';
import { normalizeHabitName } from '../utils/habitNames';

// Database row types (snake_case from Supabase)
interface DbHabit {
  id: string;
  user_id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  weekly_days: HabitWeekday[] | null;
  weekly_count: number | null;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime' | null;
  reason: string | null;
  icon: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
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
    name: normalizeHabitName(dbHabit.name),
    frequency: dbHabit.frequency,
    weeklyDays: dbHabit.weekly_days ?? undefined,
    weeklyCount:
      dbHabit.weekly_count ?? (dbHabit.frequency === 'weekly' ? 1 : undefined),
    timeOfDay: dbHabit.time_of_day ?? undefined,
    reason: dbHabit.reason ?? undefined,
    icon: dbHabit.icon ?? undefined,
    active: dbHabit.active,
    createdAt: new Date(dbHabit.created_at).getTime(),
    updatedAt: new Date(dbHabit.updated_at).getTime(),
  };
}

// Habits CRUD
export async function getHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .order('active', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching habits:', error);
    throw error;
  }

  return (data as DbHabit[]).map(mapDbHabitToHabit);
}

export async function addHabit(habit: HabitDraft): Promise<Habit> {
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
      name: normalizeHabitName(habit.name),
      frequency: habit.frequency,
      weekly_days: habit.frequency === 'daily' ? habit.weeklyDays ?? null : null,
      weekly_count:
        habit.frequency === 'weekly' ? habit.weeklyCount ?? 1 : null,
      time_of_day: habit.timeOfDay ?? null,
      reason: habit.reason ?? null,
      icon: habit.icon ?? null,
      active: true,
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
  updates: Partial<HabitDraft>
): Promise<Habit> {
  const updateData: Partial<DbHabit> = {};

  if (updates.name !== undefined) updateData.name = normalizeHabitName(updates.name);
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.frequency === 'daily') {
    updateData.weekly_days = updates.weeklyDays ?? null;
    updateData.weekly_count = null;
  } else if (updates.frequency === 'weekly') {
    updateData.weekly_days = null;
    updateData.weekly_count = updates.weeklyCount ?? 1;
  } else {
    if (updates.weeklyDays !== undefined) {
      updateData.weekly_days = updates.weeklyDays ?? null;
    }
    if (updates.weeklyCount !== undefined) {
      updateData.weekly_count = updates.weeklyCount ?? null;
    }
  }
  if (updates.timeOfDay !== undefined)
    updateData.time_of_day = updates.timeOfDay;
  if (updates.reason !== undefined) updateData.reason = updates.reason;
  if (updates.icon !== undefined) updateData.icon = updates.icon;

  const { data, error } = await supabase
    .from('habits')
    .update(updateData)
    .eq('id', habitId)
    .select()
    .single();

  if (error) {
    console.error('Error updating habit:', error);
    throw error;
  }

  return mapDbHabitToHabit(data as DbHabit);
}

async function setHabitActiveState(habitId: string, active: boolean): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .update({ active })
    .eq('id', habitId)
    .select()
    .single();

  if (error) {
    console.error(`Error ${active ? 'restoring' : 'archiving'} habit:`, error);
    throw error;
  }

  return mapDbHabitToHabit(data as DbHabit);
}

export async function archiveHabit(habitId: string): Promise<Habit> {
  return setHabitActiveState(habitId, false);
}

export async function restoreHabit(habitId: string): Promise<Habit> {
  return setHabitActiveState(habitId, true);
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

export async function getLogsForHabitInRange(
  habitId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, HabitStatus>> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('date, status')
    .eq('habit_id', habitId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    console.error('Error fetching logs for habit range:', error);
    throw error;
  }

  const logsMap = new Map<string, HabitStatus>();
  for (const log of data as { date: string; status: HabitStatus }[]) {
    logsMap.set(log.date, log.status);
  }

  return logsMap;
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
