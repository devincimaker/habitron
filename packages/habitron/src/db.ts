/* eslint-disable max-lines -- HAB-89: split pending */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DailyPlan,
  DailyPlanItem,
  DailyPlanItemOutcome,
  DailyPlanSource,
  DailyPlanStatus,
  DesiredHabit,
  HabitStatus,
  HabitWeekday,
  JournalEntry,
  JournalMood,
  Memory,
  MemoryCategory,
  Priority,
  TodoStatus,
} from '@habits-coach/shared';
import { habitRowFromInput, type HabitFields } from './habitInput.js';
import { today } from './time.js';

/** A habit write: the pure fields, plus the two that need the database. */
export type HabitWriteInput = HabitFields & {
  /** Section *name*, resolved case-insensitively; sections are made in the app. */
  section?: string;
  /** Replaces the whole reminder set when present. */
  reminderTimes?: string[];
};

interface DbTodo {
  id: string;
  list_id: string;
  title: string;
  notes: string | null;
  status: TodoStatus;
  priority: number | null;
  due_date: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  completed_at: string | null;
  canceled_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  tag_id: string | null;
  todo_tags: DbTag | null;
  todo_checklist_items: DbChecklistItem[];
}

/** A task's category. Every task carries at most one. */
export interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface DbTag {
  id: string;
  name: string;
  color: string | null;
}

/** One entry of a task's checklist (e.g. "milk" on a groceries task). */
export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

interface DbChecklistItem {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TodoStatus;
  priority?: Priority;
  dueDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  estimateMinutes?: number;
  actualMinutes?: number;
  completedAt?: string;
  canceledAt?: string;
  /** Category (at most one per task). */
  tag?: Tag;
  /** Ordered checklist; present iff the task has at least one item. */
  checklist?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  notes?: string;
  priority?: Priority;
  dueDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  estimateMinutes?: number;
  tagId?: string;
  /** Checklist item titles in order. */
  checklist?: string[];
  /**
   * An ISO instant, already converted from local wall clock by the tool layer.
   * Its presence means the task is being logged as already done.
   */
  completedAt?: string;
  /** How long it actually took. Only meaningful alongside `completedAt`. */
  actualMinutes?: number;
}

/** `null` clears a field; `undefined` leaves it untouched. */
export interface TaskPatch {
  title?: string;
  notes?: string | null;
  priority?: Priority | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  estimateMinutes?: number | null;
  tagId?: string | null;
  /** Full replacement of the checklist; [] clears it. Done state survives for matching titles. */
  checklist?: string[];
}

interface DbHabit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'interval';
  weekly_days: HabitWeekday[] | null;
  weekly_count: number | null;
  interval_days: number | null;
  start_date: string;
  goal_days: number | null;
  goal_type: 'boolean' | 'quantity';
  target_amount: number | null;
  unit: string | null;
  check_in_mode: 'auto' | 'manual' | 'complete_all';
  record_increment: number | null;
  constant_reminder: boolean;
  auto_popup_log: boolean;
  section_id: string | null;
  reason: string | null;
  icon: string | null;
  active: boolean;
  habit_sections: { name: string; sort_order: number } | null;
  habit_reminders: { time: string }[] | null;
}

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'interval';
  /** Weekly habits pinned to specific days. */
  weeklyDays?: HabitWeekday[];
  /** Weekly habits with a flexible "N times per week" target. */
  weeklyCount?: number;
  /** Interval habits: every N days from startDate. */
  intervalDays?: number;
  startDate: string;
  /** Stop after N days, if the habit has an end in mind. */
  goalDays?: number;
  goalType: 'boolean' | 'quantity';
  targetAmount?: number;
  unit?: string;
  /** Quantity habits: how a check-in records progress. */
  checkInMode: 'auto' | 'manual' | 'complete_all';
  /** How much one 'auto' check-in adds. */
  recordIncrement?: number;
  /** Keep nudging until the habit is logged. */
  constantReminder: boolean;
  /** Open the log sheet on check-in rather than counting silently. */
  autoPopupLog: boolean;
  /** Reminder times as HH:MM, from habit_reminders. */
  reminderTimes: string[];
  /** Time-of-day grouping from the app (Morning / Afternoon / Night / Others / custom). */
  section?: string;
  reason?: string;
  icon?: string;
  active: boolean;
}

interface DbDesiredHabit {
  id: string;
  title: string;
  note: string | null;
  habit_id: string | null;
}

/** The app's desired habit, minus timestamps this layer has no use for. */
export type DesiredHabitRecord = Omit<DesiredHabit, 'createdAt' | 'updatedAt'>;

export interface HabitLogRecord {
  habitId: string;
  date: string;
  status: HabitStatus;
  /** Progress for quantity habits (0 for boolean habits). */
  amount: number;
}

interface DbJournalEntry {
  id: string;
  entry_date: string;
  content: string;
  mood: JournalMood | null;
  source: JournalEntry['source'];
  created_at: string;
  updated_at: string;
}

interface DbMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  created_at: string;
  updated_at: string;
}

interface DbDailyPlan {
  id: string;
  plan_date: string;
  version: number;
  status: DailyPlanStatus;
  source: DailyPlanSource;
  parent_plan_id: string | null;
  rationale: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbDailyPlanItem {
  id: string;
  plan_id: string;
  item_type: DailyPlanItem['itemType'];
  habit_id: string | null;
  todo_id: string | null;
  title_snapshot: string;
  notes_snapshot: string | null;
  scheduled_time: string | null;
  estimate_minutes_snapshot: number | null;
  is_optional: boolean;
  position: number;
  outcome: DailyPlanItemOutcome;
  resolved_at: string | null;
}

export interface PlanItemInput {
  itemType: DailyPlanItem['itemType'];
  todoId?: string;
  habitId?: string;
  title: string;
  notes?: string;
  scheduledTime?: string;
  estimateMinutes?: number;
  isOptional: boolean;
}

/** All Supabase reads and writes for one user. */
export function createDb(supabase: SupabaseClient, userId: string) {
  function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data as T;
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  const TODO_COLUMNS =
    'id, list_id, title, notes, status, priority, due_date, scheduled_date, scheduled_time, estimate_minutes, actual_minutes, completed_at, canceled_at, sort_order, created_at, updated_at, tag_id, todo_tags(id, name, color), todo_checklist_items(id, title, done, position)';




  function mapTag(row: DbTag): Tag {
    return { id: row.id, name: row.name, color: row.color ?? undefined };
  }

  function mapChecklist(rows: DbChecklistItem[]): ChecklistItem[] | undefined {
    if (rows.length === 0) return undefined;
    return [...rows]
      .sort((a, b) => a.position - b.position)
      .map((row) => ({ id: row.id, title: row.title, done: row.done, position: row.position }));
  }


  function mapTodo(row: DbTodo): Task {
    return {
      id: row.id,
      title: row.title,
      notes: row.notes ?? undefined,
      status: row.status,
      priority: (row.priority ?? undefined) as Priority | undefined,
      dueDate: row.due_date ?? undefined,
      scheduledDate: row.scheduled_date ?? undefined,
      scheduledTime: row.scheduled_time ?? undefined,
      estimateMinutes: row.estimate_minutes ?? undefined,
      actualMinutes: row.actual_minutes ?? undefined,
      completedAt: row.completed_at ?? undefined,
      canceledAt: row.canceled_at ?? undefined,
      tag: row.todo_tags ? mapTag(row.todo_tags) : undefined,
      checklist: mapChecklist(row.todo_checklist_items),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function listAllTasks(): Promise<Task[]> {
    const rows = unwrap(
      await supabase
        .from('todos')
        .select(TODO_COLUMNS)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
    ) as unknown as DbTodo[];
    return rows.map(mapTodo);
  }

  async function getTask(id: string): Promise<Task> {
    const row = unwrap(
      await supabase.from('todos').select(TODO_COLUMNS).eq('user_id', userId).eq('id', id).maybeSingle()
    ) as unknown as DbTodo | null;
    if (!row) {
      throw new Error(`Task not found: ${id}`);
    }
    return mapTodo(row);
  }

  async function getTasksByIds(ids: string[]): Promise<Map<string, Task>> {
    if (ids.length === 0) return new Map();
    const rows = unwrap(
      await supabase.from('todos').select(TODO_COLUMNS).eq('user_id', userId).in('id', ids)
    ) as unknown as DbTodo[];
    return new Map(rows.map((row) => [row.id, mapTodo(row)]));
  }

  async function inboxListId(): Promise<string> {
    const row = unwrap(
      await supabase
        .from('todo_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('is_inbox', true)
        .maybeSingle()
    ) as { id: string } | null;
    if (row) return row.id;

    const created = unwrap(
      await supabase
        .from('todo_lists')
        .insert({ user_id: userId, name: 'Inbox', is_inbox: true, sort_order: 0 })
        .select('id')
        .single()
    ) as { id: string };
    return created.id;
  }


  /**
   * Replaces the task's checklist with `titles` (in order). Items whose title
   * matches an existing one (case-insensitive) keep their done state, so a
   * coach edit doesn't untick things.
   */
  async function replaceChecklist(todoId: string, titles: string[]): Promise<void> {
    const existing = unwrap(
      await supabase
        .from('todo_checklist_items')
        .select('id, title, done')
        .eq('user_id', userId)
        .eq('todo_id', todoId)
    ) as Array<{ id: string; title: string; done: boolean }>;

    const doneByTitle = new Map(existing.map((item) => [item.title.trim().toLowerCase(), item.done]));

    unwrap(
      await supabase
        .from('todo_checklist_items')
        .delete()
        .eq('user_id', userId)
        .eq('todo_id', todoId)
    );

    const items = titles.map((title) => title.trim()).filter((title) => title.length > 0);
    if (items.length > 0) {
      unwrap(
        await supabase.from('todo_checklist_items').insert(
          items.map((title, position) => ({
            user_id: userId,
            todo_id: todoId,
            title,
            done: doneByTitle.get(title.toLowerCase()) ?? false,
            position,
          }))
        )
      );
    }
  }

  async function setChecklistItemDone(itemId: string, done: boolean): Promise<ChecklistItem> {
    const row = unwrap(
      await supabase
        .from('todo_checklist_items')
        .update({ done })
        .eq('user_id', userId)
        .eq('id', itemId)
        .select('id, title, done, position')
        .maybeSingle()
    ) as DbChecklistItem | null;
    if (!row) {
      throw new Error(`Checklist item not found: ${itemId}`);
    }
    return { id: row.id, title: row.title, done: row.done, position: row.position };
  }

  async function assertTagExists(tagId: string): Promise<void> {
    const row = unwrap(
      await supabase.from('todo_tags').select('id').eq('user_id', userId).eq('id', tagId).maybeSingle()
    ) as { id: string } | null;
    if (!row) {
      throw new Error(`Unknown tag: ${tagId}. Call list_tags to see the available categories.`);
    }
  }

  async function createTask(input: TaskInput): Promise<Task> {
    if (input.actualMinutes !== undefined && !input.completedAt) {
      throw new Error(
        'actualMinutes records how long something already done took, so it needs completedAt. ' +
          'To record it on a task that already exists, use set_task_status.'
      );
    }
    if (input.tagId) await assertTagExists(input.tagId);
    const listId = await inboxListId();
    const row = unwrap(
      await supabase
        .from('todos')
        .insert({
          user_id: userId,
          list_id: listId,
          title: input.title,
          notes: input.notes ?? null,
          priority: input.priority ?? null,
          due_date: input.dueDate ?? null,
          scheduled_date: input.scheduledDate ?? null,
          scheduled_time: input.scheduledTime ?? null,
          estimate_minutes: input.estimateMinutes ?? null,
          tag_id: input.tagId ?? null,
          sort_order: Date.now(),
          status: input.completedAt ? 'completed' : 'open',
          completed_at: input.completedAt ?? null,
          actual_minutes: input.actualMinutes ?? null,
        })
        .select(TODO_COLUMNS)
        .single()
    ) as unknown as DbTodo;
    if (input.checklist?.length) {
      await replaceChecklist(row.id, input.checklist);
      return getTask(row.id);
    }
    return mapTodo(row);
  }


  async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
    if (patch.tagId) await assertTagExists(patch.tagId);
    if (patch.checklist !== undefined) {
      // Ensure the task exists (and belongs to the user) before touching items.
      await getTask(id);
      await replaceChecklist(id, patch.checklist);
    }
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.priority !== undefined) update.priority = patch.priority;
    if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
    if (patch.scheduledDate !== undefined) update.scheduled_date = patch.scheduledDate;
    if (patch.scheduledTime !== undefined) update.scheduled_time = patch.scheduledTime;
    if (patch.estimateMinutes !== undefined) update.estimate_minutes = patch.estimateMinutes;
    if (patch.tagId !== undefined) update.tag_id = patch.tagId;
    if (patch.scheduledDate === null) update.scheduled_time = null;

    if (Object.keys(update).length === 0) {
      return getTask(id);
    }

    const row = unwrap(
      await supabase
        .from('todos')
        .update(update)
        .eq('user_id', userId)
        .eq('id', id)
        .select(TODO_COLUMNS)
        .maybeSingle()
    ) as unknown as DbTodo | null;
    if (!row) {
      throw new Error(`Task not found: ${id}`);
    }
    return mapTodo(row);
  }

  async function setTaskStatus(
    id: string,
    status: TodoStatus,
    actualMinutes?: number
  ): Promise<Task> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status,
      completed_at: status === 'completed' ? now : null,
      canceled_at: status === 'canceled' ? now : null,
    };
    if (status === 'completed' && actualMinutes !== undefined) {
      update.actual_minutes = actualMinutes;
    }
    if (status === 'open') {
      update.actual_minutes = null;
    }

    const row = unwrap(
      await supabase
        .from('todos')
        .update(update)
        .eq('user_id', userId)
        .eq('id', id)
        .select(TODO_COLUMNS)
        .maybeSingle()
    ) as unknown as DbTodo | null;
    if (!row) {
      throw new Error(`Task not found: ${id}`);
    }
    return mapTodo(row);
  }

  async function deleteTask(id: string): Promise<void> {
    unwrap(await supabase.from('todos').delete().eq('user_id', userId).eq('id', id));
  }

  // ---------------------------------------------------------------------------
  // Tags (categories)
  // ---------------------------------------------------------------------------

  async function listTags(): Promise<Tag[]> {
    const rows = unwrap(
      await supabase.from('todo_tags').select('id, name, color').eq('user_id', userId).order('name', { ascending: true })
    ) as DbTag[];
    return rows.map(mapTag);
  }

  async function createTag(name: string, color?: string): Promise<Tag> {
    const trimmed = name.trim();
    const existing = (await listTags()).find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      throw new Error(`Tag "${existing.name}" already exists (${existing.id})`);
    }
    const row = unwrap(
      await supabase
        .from('todo_tags')
        .insert({ user_id: userId, name: trimmed, color: color ?? null })
        .select('id, name, color')
        .single()
    ) as DbTag;
    return mapTag(row);
  }

  async function updateTag(id: string, patch: { name?: string; color?: string | null }): Promise<Tag> {
    const tags = await listTags();
    const current = tags.find((t) => t.id === id);
    if (!current) {
      throw new Error(`Unknown tag: ${id}. Call list_tags to see the available categories.`);
    }

    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new Error('Tag name cannot be empty');
      const clash = tags.find((t) => t.id !== id && t.name.toLowerCase() === trimmed.toLowerCase());
      if (clash) throw new Error(`Tag "${clash.name}" already exists (${clash.id})`);
      update.name = trimmed;
    }
    if (patch.color !== undefined) update.color = patch.color;
    if (Object.keys(update).length === 0) return current;

    const row = unwrap(
      await supabase
        .from('todo_tags')
        .update(update)
        .eq('user_id', userId)
        .eq('id', id)
        .select('id, name, color')
        .single()
    ) as DbTag;
    return mapTag(row);
  }

  async function countTasksWithTag(tagId: string): Promise<number> {
    const { count, error } = await supabase
      .from('todos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tag_id', tagId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async function deleteTag(
    id: string,
    reassignToTagId?: string
  ): Promise<{ deleted: Tag; tasksAffected: number; reassignedTo?: Tag }> {
    const tags = await listTags();
    const target = tags.find((t) => t.id === id);
    if (!target) {
      throw new Error(`Unknown tag: ${id}. Call list_tags to see the available categories.`);
    }

    let reassignedTo: Tag | undefined;
    if (reassignToTagId !== undefined) {
      if (reassignToTagId === id) throw new Error('Cannot reassign a tag to itself');
      reassignedTo = tags.find((t) => t.id === reassignToTagId);
      if (!reassignedTo) {
        throw new Error(`Unknown tag: ${reassignToTagId}. Call list_tags to see the available categories.`);
      }
    }

    const tasksAffected = await countTasksWithTag(id);
    if (reassignedTo) {
      unwrap(
        await supabase
          .from('todos')
          .update({ tag_id: reassignedTo.id })
          .eq('user_id', userId)
          .eq('tag_id', id)
          .select('id')
      );
    }

    // Any task still pointing here is uncategorised by the FK (ON DELETE SET NULL).
    unwrap(await supabase.from('todo_tags').delete().eq('user_id', userId).eq('id', id).select('id'));

    return { deleted: target, tasksAffected, reassignedTo };
  }

  // ---------------------------------------------------------------------------
  // Habits
  // ---------------------------------------------------------------------------

  // Habit shape follows the live schema (habit form v2): sections replace time_of_day,
  // frequency gains 'interval', and goals can be boolean or a quantity per day.
  const HABIT_COLUMNS =
    'id, name, frequency, weekly_days, weekly_count, interval_days, start_date, goal_days, goal_type, target_amount, unit, check_in_mode, record_increment, constant_reminder, auto_popup_log, section_id, reason, icon, active, habit_sections(name, sort_order), habit_reminders(time)';



  function mapHabit(row: DbHabit): Habit {
    return {
      id: row.id,
      name: row.name,
      frequency: row.frequency,
      weeklyDays: row.weekly_days ?? undefined,
      weeklyCount: row.weekly_count ?? undefined,
      intervalDays: row.interval_days ?? undefined,
      startDate: row.start_date,
      goalDays: row.goal_days ?? undefined,
      goalType: row.goal_type,
      targetAmount: row.target_amount === null ? undefined : Number(row.target_amount),
      unit: row.unit ?? undefined,
      checkInMode: row.check_in_mode,
      recordIncrement: row.record_increment === null ? undefined : Number(row.record_increment),
      constantReminder: row.constant_reminder,
      autoPopupLog: row.auto_popup_log,
      reminderTimes: (row.habit_reminders ?? []).map((r) => r.time).sort(),
      section: row.habit_sections?.name,
      reason: row.reason ?? undefined,
      icon: row.icon ?? undefined,
      active: row.active,
    };
  }

  async function listHabits(includeInactive = false): Promise<Habit[]> {
    let query = supabase.from('habits').select(HABIT_COLUMNS).eq('user_id', userId);
    if (!includeInactive) {
      query = query.eq('active', true);
    }
    const rows = unwrap(await query.order('created_at', { ascending: true })) as unknown as DbHabit[];
    return rows.map(mapHabit);
  }

  async function getHabitsByIds(ids: string[]): Promise<Map<string, Habit>> {
    if (ids.length === 0) return new Map();
    const rows = unwrap(
      await supabase.from('habits').select(HABIT_COLUMNS).eq('user_id', userId).in('id', ids)
    ) as unknown as DbHabit[];
    return new Map(rows.map((row) => [row.id, mapHabit(row)]));
  }


  /** Sections are created in the app, so an unknown name lists what exists. */
  async function resolveSectionId(name: string): Promise<string> {
    const rows = unwrap(
      await supabase.from('habit_sections').select('id, name').eq('user_id', userId)
    ) as Array<{ id: string; name: string }>;
    const match = rows.find((row) => row.name.toLowerCase() === name.trim().toLowerCase());
    if (!match) {
      const known = rows.map((row) => row.name).join(', ') || 'none yet';
      throw new Error(`Unknown habit section: ${name}. Existing sections: ${known}.`);
    }
    return match.id;
  }

  async function replaceReminders(habitId: string, times: string[]): Promise<void> {
    unwrap(
      await supabase.from('habit_reminders').delete().eq('habit_id', habitId).eq('user_id', userId)
    );
    const unique = Array.from(new Set(times));
    if (unique.length === 0) return;
    unwrap(
      await supabase
        .from('habit_reminders')
        .insert(unique.map((time) => ({ habit_id: habitId, user_id: userId, time })))
    );
  }

  async function getHabit(id: string): Promise<Habit> {
    const row = unwrap(
      await supabase.from('habits').select(HABIT_COLUMNS).eq('user_id', userId).eq('id', id).single()
    ) as unknown as DbHabit;
    return mapHabit(row);
  }

  async function createHabit(input: HabitWriteInput, timezone: string): Promise<Habit> {
    const { section, reminderTimes, ...fields } = input;
    const row = habitRowFromInput(fields, {
      today: today(timezone),
      ...(section !== undefined ? { sectionId: await resolveSectionId(section) } : {}),
    });
    const created = unwrap(
      await supabase
        .from('habits')
        .insert({ user_id: userId, active: true, ...row })
        .select('id')
        .single()
    ) as { id: string };
    if (reminderTimes) await replaceReminders(created.id, reminderTimes);
    return getHabit(created.id);
  }

  async function updateHabit(
    id: string,
    input: HabitWriteInput,
    timezone: string
  ): Promise<Habit> {
    const { section, reminderTimes, ...fields } = input;
    // A partial patch is checked against the habit's current mode, not a default.
    const current = await getHabit(id);
    const row = habitRowFromInput(fields, {
      today: today(timezone),
      existing: {
        frequency: current.frequency,
        goalType: current.goalType,
        checkInMode: current.checkInMode,
      },
      ...(section !== undefined ? { sectionId: await resolveSectionId(section) } : {}),
    });
    if (Object.keys(row).length > 0) {
      unwrap(await supabase.from('habits').update(row).eq('user_id', userId).eq('id', id));
    }
    if (reminderTimes) await replaceReminders(id, reminderTimes);
    return getHabit(id);
  }

  /** Reversible on purpose: archiving keeps the logs, deleting would not. */
  async function setHabitActive(id: string, active: boolean): Promise<Habit> {
    unwrap(await supabase.from('habits').update({ active }).eq('user_id', userId).eq('id', id));
    return getHabit(id);
  }

  async function listHabitLogs(start: string, end: string): Promise<HabitLogRecord[]> {
    const rows = unwrap(
      await supabase
        .from('habit_logs')
        .select('habit_id, date, status, amount')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
    ) as Array<{ habit_id: string; date: string; status: HabitStatus; amount: number | string }>;
    return rows.map((row) => ({
      habitId: row.habit_id,
      date: row.date,
      status: row.status,
      amount: Number(row.amount ?? 0),
    }));
  }

  async function logHabit(input: {
    habitId: string;
    date: string;
    status: HabitStatus;
    amount?: number;
  }): Promise<HabitLogRecord> {
    const row: Record<string, unknown> = {
      habit_id: input.habitId,
      user_id: userId,
      date: input.date,
      status: input.status,
    };
    if (input.amount !== undefined) row.amount = input.amount;
    unwrap(await supabase.from('habit_logs').upsert(row, { onConflict: 'habit_id,date' }));
    return { ...input, amount: input.amount ?? 0 };
  }

  // ---------------------------------------------------------------------------
  // Journal
  // ---------------------------------------------------------------------------


  function mapJournal(row: DbJournalEntry): JournalEntry {
    return {
      id: row.id,
      entryDate: row.entry_date,
      content: row.content,
      mood: row.mood ?? undefined,
      source: row.source,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  async function listRecentJournalEntries(limit: number): Promise<JournalEntry[]> {
    const rows = unwrap(
      await supabase
        .from('journal_entries')
        .select('id, entry_date, content, mood, source, created_at, updated_at')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
    ) as DbJournalEntry[];
    return rows.map(mapJournal);
  }

  async function addJournalEntry(input: {
    entryDate: string;
    content: string;
    mood?: JournalMood;
  }): Promise<JournalEntry> {
    const row = unwrap(
      await supabase
        .from('journal_entries')
        .insert({
          user_id: userId,
          entry_date: input.entryDate,
          content: input.content,
          mood: input.mood ?? null,
          source: 'coach',
        })
        .select('id, entry_date, content, mood, source, created_at, updated_at')
        .single()
    ) as DbJournalEntry;
    return mapJournal(row);
  }

  // ---------------------------------------------------------------------------
  // Memories
  // ---------------------------------------------------------------------------


  function mapMemory(row: DbMemory): Memory {
    return {
      id: row.id,
      content: row.content,
      category: row.category,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  // ---------------------------------------------------------------------------
  // Desired habits
  // ---------------------------------------------------------------------------

  const DESIRED_HABIT_COLUMNS = 'id, title, note, habit_id';

  function mapDesiredHabit(row: DbDesiredHabit): DesiredHabitRecord {
    return {
      id: row.id,
      title: row.title,
      note: row.note ?? undefined,
      habitId: row.habit_id ?? undefined,
    };
  }

  /**
   * Oldest first: the list has no ordering of its own, so `created_at` is it.
   * `id` breaks ties, because rows inserted in one statement share a timestamp
   * and an update would otherwise reshuffle them — the coach says "first on your
   * list" out loud, so that has to mean the same thing on the next turn.
   */
  async function listDesiredHabits(): Promise<DesiredHabitRecord[]> {
    const rows = unwrap(
      await supabase
        .from('desired_habits')
        .select(DESIRED_HABIT_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    ) as DbDesiredHabit[];
    return rows.map(mapDesiredHabit);
  }

  async function addDesiredHabit(title: string, note?: string): Promise<DesiredHabitRecord> {
    const row = unwrap(
      await supabase
        .from('desired_habits')
        .insert({ user_id: userId, title, note: note ?? null })
        .select(DESIRED_HABIT_COLUMNS)
        .single()
    ) as DbDesiredHabit;
    return mapDesiredHabit(row);
  }

  /** `habitId: null` clears the stand-in; omitting a field leaves it alone. */
  async function updateDesiredHabit(
    id: string,
    patch: { title?: string; note?: string | null; habitId?: string | null }
  ): Promise<DesiredHabitRecord> {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.note !== undefined) update.note = patch.note;
    if (patch.habitId !== undefined) update.habit_id = patch.habitId;

    if (Object.keys(update).length === 0) {
      const current = unwrap(
        await supabase
          .from('desired_habits')
          .select(DESIRED_HABIT_COLUMNS)
          .eq('user_id', userId)
          .eq('id', id)
          .single()
      ) as DbDesiredHabit;
      return mapDesiredHabit(current);
    }

    const row = unwrap(
      await supabase
        .from('desired_habits')
        .update(update)
        .eq('user_id', userId)
        .eq('id', id)
        .select(DESIRED_HABIT_COLUMNS)
        .single()
    ) as DbDesiredHabit;
    return mapDesiredHabit(row);
  }

  async function deleteDesiredHabit(id: string): Promise<void> {
    unwrap(await supabase.from('desired_habits').delete().eq('user_id', userId).eq('id', id));
  }

  async function listMemories(): Promise<Memory[]> {
    const rows = unwrap(
      await supabase
        .from('memories')
        .select('id, content, category, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ) as DbMemory[];
    return rows.map(mapMemory);
  }

  async function addMemory(content: string, category: MemoryCategory): Promise<Memory> {
    const row = unwrap(
      await supabase
        .from('memories')
        .insert({ user_id: userId, content, category, source_session_at: new Date().toISOString() })
        .select('id, content, category, created_at, updated_at')
        .single()
    ) as DbMemory;
    return mapMemory(row);
  }

  async function deleteMemory(id: string): Promise<void> {
    unwrap(await supabase.from('memories').delete().eq('user_id', userId).eq('id', id));
  }

  // ---------------------------------------------------------------------------
  // Daily plans
  // ---------------------------------------------------------------------------



  function mapPlanItem(row: DbDailyPlanItem): DailyPlanItem {
    return {
      id: row.id,
      planId: row.plan_id,
      itemType: row.item_type,
      habitId: row.habit_id ?? undefined,
      todoId: row.todo_id ?? undefined,
      titleSnapshot: row.title_snapshot,
      notesSnapshot: row.notes_snapshot ?? undefined,
      scheduledTime: row.scheduled_time ?? undefined,
      estimateMinutesSnapshot: row.estimate_minutes_snapshot ?? undefined,
      isOptional: row.is_optional,
      position: row.position,
      outcome: row.outcome,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
    };
  }

  function mapPlan(row: DbDailyPlan, items: DbDailyPlanItem[]): DailyPlan {
    return {
      id: row.id,
      planDate: row.plan_date,
      version: row.version,
      status: row.status,
      source: row.source,
      parentPlanId: row.parent_plan_id ?? undefined,
      rationale: row.rationale ?? undefined,
      acceptedAt: row.accepted_at ? new Date(row.accepted_at).getTime() : undefined,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      items: [...items].sort((a, b) => a.position - b.position).map(mapPlanItem),
    };
  }

  async function loadPlanItems(planIds: string[]): Promise<Map<string, DbDailyPlanItem[]>> {
    if (planIds.length === 0) return new Map();
    const rows = unwrap(
      await supabase.from('daily_plan_items').select('*').in('plan_id', planIds)
    ) as DbDailyPlanItem[];
    const byPlan = new Map<string, DbDailyPlanItem[]>();
    for (const row of rows) {
      const list = byPlan.get(row.plan_id) ?? [];
      list.push(row);
      byPlan.set(row.plan_id, list);
    }
    return byPlan;
  }

  async function getActivePlan(date: string): Promise<DailyPlan | null> {
    const row = unwrap(
      await supabase
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_date', date)
        .in('status', ['accepted', 'draft'])
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
    ) as DbDailyPlan | null;
    if (!row) return null;
    const items = await loadPlanItems([row.id]);
    return mapPlan(row, items.get(row.id) ?? []);
  }

  /** Every plan version (any status) whose date falls in [start, end]. */
  async function listPlans(start: string, end: string): Promise<DailyPlan[]> {
    const rows = unwrap(
      await supabase
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .gte('plan_date', start)
        .lte('plan_date', end)
        .order('plan_date', { ascending: false })
        .order('version', { ascending: false })
    ) as DbDailyPlan[];
    const items = await loadPlanItems(rows.map((row) => row.id));
    return rows.map((row) => mapPlan(row, items.get(row.id) ?? []));
  }


  async function saveAcceptedPlan(input: {
    date: string;
    rationale?: string;
    items: PlanItemInput[];
  }): Promise<DailyPlan> {
    const previous = unwrap(
      await supabase
        .from('daily_plans')
        .select('id, version')
        .eq('user_id', userId)
        .eq('plan_date', input.date)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
    ) as { id: string; version: number } | null;

    unwrap(
      await supabase
        .from('daily_plans')
        .update({ status: 'superseded' })
        .eq('user_id', userId)
        .eq('plan_date', input.date)
        .in('status', ['accepted', 'draft'])
    );

    const plan = unwrap(
      await supabase
        .from('daily_plans')
        .insert({
          user_id: userId,
          plan_date: input.date,
          version: (previous?.version ?? 0) + 1,
          status: 'accepted',
          source: 'coach',
          parent_plan_id: previous?.id ?? null,
          rationale: input.rationale ?? null,
          accepted_at: new Date().toISOString(),
        })
        .select('*')
        .single()
    ) as DbDailyPlan;

    if (input.items.length > 0) {
      unwrap(
        await supabase.from('daily_plan_items').insert(
          input.items.map((item, position) => ({
            plan_id: plan.id,
            user_id: userId,
            item_type: item.itemType,
            habit_id: item.itemType === 'habit' ? item.habitId : null,
            todo_id: item.itemType === 'todo' ? item.todoId : null,
            title_snapshot: item.title,
            notes_snapshot: item.notes ?? null,
            scheduled_time: item.scheduledTime ?? null,
            estimate_minutes_snapshot: item.estimateMinutes ?? null,
            is_optional: item.isOptional,
            position,
          }))
        )
      );
    }

    const items = await loadPlanItems([plan.id]);
    return mapPlan(plan, items.get(plan.id) ?? []);
  }

  async function setPlanItemOutcome(
    itemId: string,
    outcome: DailyPlanItemOutcome
  ): Promise<DailyPlanItem> {
    const row = unwrap(
      await supabase
        .from('daily_plan_items')
        .update({ outcome, resolved_at: outcome === 'planned' ? null : new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', itemId)
        .select('*')
        .maybeSingle()
    ) as DbDailyPlanItem | null;
    if (!row) {
      throw new Error(`Plan item not found: ${itemId}`);
    }
    return mapPlanItem(row);
  }

  return {
    listAllTasks,
    getTask,
    getTasksByIds,
    createTask,
    updateTask,
    setTaskStatus,
    deleteTask,
    setChecklistItemDone,
    listTags,
    createTag,
    updateTag,
    countTasksWithTag,
    deleteTag,
    listHabits,
    getHabitsByIds,
    createHabit,
    updateHabit,
    setHabitActive,
    listHabitLogs,
    logHabit,
    listRecentJournalEntries,
    addJournalEntry,
    listDesiredHabits,
    addDesiredHabit,
    updateDesiredHabit,
    deleteDesiredHabit,
    listMemories,
    addMemory,
    deleteMemory,
    getActivePlan,
    listPlans,
    saveAcceptedPlan,
    setPlanItemOutcome,
  };
}

export type Db = ReturnType<typeof createDb>;
