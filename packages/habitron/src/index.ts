import { createClient } from '@supabase/supabase-js';
import type { Module } from '@habits-coach/shared';
import { buildDayContext } from './context.js';
import { createDb, type Db } from './db.js';
import {
  buildDayReviewHistory,
  buildHabitHistory,
  buildJournalHistory,
  buildTaskHistory,
} from './history.js';
import { createTools, type AnyHabitronTool } from './tools.js';

export type { Db, Habit, HabitLogRecord, PlanItemInput, Tag, Task, TaskInput, TaskList, TaskPatch } from './db.js';
export type { DayContext, HabitForDay } from './context.js';
export type { GoalRecord } from './goals.js';
// One definition of "reviewed" for the ritual card HAB-86 adds. Note the hub is
// in `apps/mobile`, which depends on `@habits-coach/shared` and not on this
// package, so HAB-86 reaches this through `apps/api` or moves it — see the PR.
export { reviewStreak, type ReviewStreak } from './dayReview.js';
export type { AnyHabitronTool, HabitronTool } from './tools.js';
export { addDays, isIsoDate, localNow, today, weekRange, weekdayOf, type LocalNow } from './time.js';

export interface HabitronConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  /** The auth.users id every read and write is scoped to. */
  userId: string;
  /** IANA timezone used for "today" and "now". */
  timezone: string;
}

export interface Habitron {
  db: Db;
  timezone: string;
  /** The modules Profile has switched off. Each has no tools and no place in the packet. */
  disabledModules: Module[];
  /** The coach's tool surface, host-agnostic (see `HabitronTool`). */
  tools: AnyHabitronTool[];
  buildDayContext: (date: string) => ReturnType<typeof buildDayContext>;
  buildHabitHistory: (args: { days: number; habitId?: string }) => ReturnType<typeof buildHabitHistory>;
  buildTaskHistory: (args: { days: number }) => ReturnType<typeof buildTaskHistory>;
  buildJournalHistory: (args: { days: number }) => ReturnType<typeof buildJournalHistory>;
  buildDayReviewHistory: (args: { days: number }) => ReturnType<typeof buildDayReviewHistory>;
}

/**
 * Habitron's data and coaching tools for one user, backed by the service-role
 * Supabase client. Reads the module switches once, so a host that lives long
 * (the stdio MCP server) sees a change on its next start; the in-app coach
 * builds one per turn and sees it at once.
 */
export async function createHabitron(config: HabitronConfig): Promise<Habitron> {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = createDb(supabase, config.userId);
  const { timezone } = config;
  const disabledModules = await db.listDisabledModules();

  return {
    db,
    timezone,
    disabledModules,
    tools: createTools(db, timezone, disabledModules),
    buildDayContext: (date) => buildDayContext(db, timezone, date, disabledModules),
    buildHabitHistory: (args) => buildHabitHistory(db, timezone, args),
    buildTaskHistory: (args) => buildTaskHistory(db, timezone, args),
    buildJournalHistory: (args) => buildJournalHistory(db, timezone, args),
    buildDayReviewHistory: (args) => buildDayReviewHistory(db, timezone, args),
  };
}
