/* eslint-disable max-lines -- HAB-89: split pending */
import { supabase } from './supabase';
import {
  HABIT_DEFAULT_SECTION_NAMES,
  Habit,
  HabitCheckInMode,
  HabitDraft,
  HabitFrequency,
  HabitGoalType,
  HabitLogEntry,
  HabitSection,
  HabitStatus,
  HabitWeekday,
} from '@habits-coach/shared';
import { normalizeHabitName } from '../utils/habitNames';

// Database row types (snake_case from Supabase)
interface DbHabit {
  id: string;
  user_id: string;
  name: string;
  frequency: HabitFrequency;
  weekly_days: HabitWeekday[] | null;
  weekly_count: number | null;
  interval_days: number | null;
  start_date: string;
  goal_days: number | null;
  goal_type: HabitGoalType;
  target_amount: number | string | null;
  unit: string | null;
  check_in_mode: HabitCheckInMode;
  record_increment: number | string | null;
  section_id: string | null;
  position: number;
  constant_reminder: boolean;
  auto_popup_log: boolean;
  reason: string | null;
  icon: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  habit_reminders: { time: string }[];
}

interface DbHabitSection {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
}

interface DbHabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  status: HabitStatus;
  amount: number | string;
}

const HABIT_SELECT = '*, habit_reminders(time)';

function toNumber(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  return typeof value === 'number' ? value : Number(value);
}

/** Postgres TIME comes back as HH:MM:SS; the app uses HH:MM. */
function toReminderTime(time: string): string {
  return time.slice(0, 5);
}

function mapDbHabitToHabit(dbHabit: DbHabit): Habit {
  return {
    id: dbHabit.id,
    name: normalizeHabitName(dbHabit.name),
    frequency: dbHabit.frequency,
    weeklyDays: dbHabit.weekly_days ?? undefined,
    weeklyCount: dbHabit.weekly_count ?? undefined,
    intervalDays: dbHabit.interval_days ?? undefined,
    startDate: dbHabit.start_date,
    goalDays: dbHabit.goal_days ?? undefined,
    goalType: dbHabit.goal_type,
    targetAmount: toNumber(dbHabit.target_amount),
    unit: dbHabit.unit ?? undefined,
    checkInMode: dbHabit.check_in_mode,
    recordIncrement: toNumber(dbHabit.record_increment),
    sectionId: dbHabit.section_id ?? undefined,
    position: dbHabit.position,
    reminderTimes: (dbHabit.habit_reminders ?? [])
      .map((reminder) => toReminderTime(reminder.time))
      .sort(),
    constantReminder: dbHabit.constant_reminder,
    autoPopupLog: dbHabit.auto_popup_log,
    reason: dbHabit.reason ?? undefined,
    icon: dbHabit.icon ?? undefined,
    active: dbHabit.active,
    createdAt: new Date(dbHabit.created_at).getTime(),
    updatedAt: new Date(dbHabit.updated_at).getTime(),
  };
}

function mapDbSectionToSection(row: DbHabitSection): HabitSection {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

function toDbHabitFields(draft: HabitDraft) {
  const isQuantity = draft.goalType === 'quantity';
  return {
    name: normalizeHabitName(draft.name),
    frequency: draft.frequency,
    weekly_days: draft.frequency === 'daily' ? draft.weeklyDays ?? null : null,
    weekly_count: draft.frequency === 'weekly' ? draft.weeklyCount ?? 1 : null,
    interval_days: draft.frequency === 'interval' ? draft.intervalDays ?? 2 : null,
    start_date: draft.startDate,
    goal_days: draft.goalDays ?? null,
    goal_type: draft.goalType,
    target_amount: isQuantity ? draft.targetAmount ?? 1 : null,
    unit: isQuantity ? draft.unit ?? 'Count' : null,
    check_in_mode: isQuantity ? draft.checkInMode : 'auto',
    record_increment:
      isQuantity && draft.checkInMode === 'auto' ? draft.recordIncrement ?? 1 : null,
    section_id: draft.sectionId ?? null,
    constant_reminder: draft.constantReminder,
    auto_popup_log: draft.autoPopupLog,
    reason: draft.reason ?? null,
    icon: draft.icon ?? null,
  };
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

async function replaceReminders(
  habitId: string,
  userId: string,
  reminderTimes: string[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('habit_reminders')
    .delete()
    .eq('habit_id', habitId);

  if (deleteError) {
    console.error('Error clearing habit reminders:', deleteError);
    throw deleteError;
  }

  const uniqueTimes = Array.from(new Set(reminderTimes));
  if (uniqueTimes.length === 0) return;

  const { error: insertError } = await supabase.from('habit_reminders').insert(
    uniqueTimes.map((time) => ({ habit_id: habitId, user_id: userId, time }))
  );

  if (insertError) {
    console.error('Error saving habit reminders:', insertError);
    throw insertError;
  }
}

async function fetchHabit(habitId: string): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_SELECT)
    .eq('id', habitId)
    .single();

  if (error) {
    console.error('Error fetching habit:', error);
    throw error;
  }

  return mapDbHabitToHabit(data as DbHabit);
}

// Habits CRUD
export async function getHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_SELECT)
    .order('active', { ascending: false })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching habits:', error);
    throw error;
  }

  return (data as DbHabit[]).map(mapDbHabitToHabit);
}

/** The next free slot at the bottom of a routine, or 0 when it is empty. */
export async function nextPositionForSection(sectionId: string | null): Promise<number> {
  let query = supabase.from('habits').select('position');
  query = sectionId === null ? query.is('section_id', null) : query.eq('section_id', sectionId);

  const { data, error } = await query.order('position', { ascending: false }).limit(1);

  if (error) {
    console.error('Error reading habit positions:', error);
    throw error;
  }

  const highest = (data as { position: number }[])[0];
  return highest ? highest.position + 1 : 0;
}

export async function addHabit(draft: HabitDraft): Promise<Habit> {
  const userId = await requireUserId();
  // A new habit belongs at the bottom of its routine, not at 0.
  const position = await nextPositionForSection(draft.sectionId ?? null);

  const { data, error } = await supabase
    .from('habits')
    .insert({ user_id: userId, active: true, position, ...toDbHabitFields(draft) })
    .select('id')
    .single();

  if (error) {
    console.error('Error adding habit:', error);
    throw error;
  }

  await replaceReminders(data.id, userId, draft.reminderTimes);
  return fetchHabit(data.id);
}

export interface HabitOrderUpdate {
  id: string;
  sectionId: string | null;
  position: number;
}

/**
 * One update per changed row. A single upsert is not an option: habits.user_id
 * and habits.name are NOT NULL with no default, so a partial upsert fails. A
 * drop touches at most two routines' worth of rows.
 */
export async function reorderHabits(updates: HabitOrderUpdate[]): Promise<void> {
  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from('habits')
        .update({ section_id: update.sectionId, position: update.position })
        .eq('id', update.id)
    )
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error('Error reordering habits:', failure.error);
    throw failure.error;
  }
}

export async function removeHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', habitId);

  if (error) {
    console.error('Error removing habit:', error);
    throw error;
  }
}

export async function updateHabit(habitId: string, draft: HabitDraft): Promise<Habit> {
  const userId = await requireUserId();

  // The editor's section picker moves a habit between routines too, so it has to
  // land at the end of the new one. `position` is absent from HabitDraft, so an
  // edit that leaves the routine alone cannot disturb the order.
  const { data: current, error: readError } = await supabase
    .from('habits')
    .select('section_id')
    .eq('id', habitId)
    .single();

  if (readError) {
    console.error('Error reading habit before update:', readError);
    throw readError;
  }

  const nextSectionId = draft.sectionId ?? null;
  const movedRoutine = (current as { section_id: string | null }).section_id !== nextSectionId;
  const fields = movedRoutine
    ? { ...toDbHabitFields(draft), position: await nextPositionForSection(nextSectionId) }
    : toDbHabitFields(draft);

  const { error } = await supabase.from('habits').update(fields).eq('id', habitId);

  if (error) {
    console.error('Error updating habit:', error);
    throw error;
  }

  await replaceReminders(habitId, userId, draft.reminderTimes);
  return fetchHabit(habitId);
}

async function setHabitActiveState(habitId: string, active: boolean): Promise<Habit> {
  const { error } = await supabase.from('habits').update({ active }).eq('id', habitId);

  if (error) {
    console.error(`Error ${active ? 'restoring' : 'archiving'} habit:`, error);
    throw error;
  }

  return fetchHabit(habitId);
}

export async function archiveHabit(habitId: string): Promise<Habit> {
  return setHabitActiveState(habitId, false);
}

export async function restoreHabit(habitId: string): Promise<Habit> {
  return setHabitActiveState(habitId, true);
}

// Sections
export async function getSections(): Promise<HabitSection[]> {
  const { data, error } = await supabase
    .from('habit_sections')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching habit sections:', error);
    throw error;
  }

  const sections = (data as DbHabitSection[]).map(mapDbSectionToSection);
  if (sections.length > 0) return sections;

  const userId = await requireUserId();
  const { data: seeded, error: seedError } = await supabase
    .from('habit_sections')
    .insert(
      HABIT_DEFAULT_SECTION_NAMES.map((name, index) => ({
        user_id: userId,
        name,
        sort_order: index,
      }))
    )
    .select('*');

  if (seedError) {
    console.error('Error seeding habit sections:', seedError);
    throw seedError;
  }

  return (seeded as DbHabitSection[]).map(mapDbSectionToSection);
}

export async function addSection(name: string, sortOrder: number): Promise<HabitSection> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('habit_sections')
    .insert({ user_id: userId, name: name.trim(), sort_order: sortOrder })
    .select('*')
    .single();

  if (error) {
    console.error('Error adding habit section:', error);
    throw error;
  }

  return mapDbSectionToSection(data as DbHabitSection);
}

export async function removeSection(sectionId: string): Promise<void> {
  const { error } = await supabase.from('habit_sections').delete().eq('id', sectionId);

  if (error) {
    console.error('Error removing habit section:', error);
    throw error;
  }
}

// Habit Logs
function mapDbLogToEntry(log: Pick<DbHabitLog, 'status' | 'amount'>): HabitLogEntry {
  return { status: log.status, amount: toNumber(log.amount) ?? 0 };
}

export async function getLogsForDate(date: string): Promise<Map<string, HabitLogEntry>> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, status, amount')
    .eq('date', date);

  if (error) {
    console.error('Error fetching logs for date:', error);
    throw error;
  }

  const logsMap = new Map<string, HabitLogEntry>();
  for (const log of data as Pick<DbHabitLog, 'habit_id' | 'status' | 'amount'>[]) {
    logsMap.set(log.habit_id, mapDbLogToEntry(log));
  }

  return logsMap;
}

export async function setHabitLog(
  habitId: string,
  date: string,
  entry: HabitLogEntry
): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase.from('habit_logs').upsert(
    {
      habit_id: habitId,
      user_id: userId,
      date,
      status: entry.status,
      amount: entry.amount,
    },
    {
      onConflict: 'habit_id,date',
    }
  );

  if (error) {
    console.error('Error setting habit log:', error);
    throw error;
  }
}
