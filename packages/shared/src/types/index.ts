/* eslint-disable max-lines -- HAB-89: split pending */
// User Profile types
export interface UserProfile {
  id: string;
  userId: string;
  name: string | null;
  createdAt: number;
  updatedAt: number;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

export type HabitFrequency = 'daily' | 'weekly' | 'interval';
export type HabitGoalType = 'boolean' | 'quantity';
export type HabitCheckInMode = 'auto' | 'manual' | 'complete_all';
export const HABIT_BUILTIN_UNITS = [
  'Count',
  'Cup',
  'Milliliter',
  'Minute',
  'Hour',
  'Kilometer',
  'Page',
] as const;
export const HABIT_GOAL_DAY_PRESETS = [7, 21, 30, 100, 365] as const;
export const HABIT_DEFAULT_SECTION_NAMES = [
  'Morning',
  'Afternoon',
  'Night',
  'Others',
] as const;
export type Priority = 1 | 2 | 3 | 4;
export const HABIT_WEEKDAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
export type HabitWeekday = (typeof HABIT_WEEKDAYS)[number];

// Goal types
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  priority?: Priority;
  targetDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GoalDraft {
  title: string;
  description?: string;
  status?: GoalStatus;
  priority?: Priority;
  targetDate?: string;
}

// Habit types
export interface HabitSection {
  id: string;
  name: string;
  sortOrder: number;
}

export interface HabitSchedule {
  frequency: HabitFrequency;
  /** Daily: which weekdays the habit is due. */
  weeklyDays?: HabitWeekday[];
  /** Weekly: how many times per week. */
  weeklyCount?: number;
  /** Interval: due every N days counted from startDate. */
  intervalDays?: number;
  /** YYYY-MM-DD; the habit is not due before this date. */
  startDate: string;
  /** Number of days the habit runs from startDate; undefined = forever. */
  goalDays?: number;
}

export interface HabitGoal {
  goalType: HabitGoalType;
  /** Quantity goals: amount to reach per due day. */
  targetAmount?: number;
  /** Quantity goals: unit label (built-in or user-defined). */
  unit?: string;
  checkInMode: HabitCheckInMode;
  /** Quantity + auto check-in: amount added per check. */
  recordIncrement?: number;
}

export interface Habit extends HabitSchedule, HabitGoal {
  id: string;
  name: string;
  reason?: string;
  icon?: string;
  sectionId?: string;
  /** Reminder times as HH:MM (24h). */
  reminderTimes: string[];
  constantReminder: boolean;
  active: boolean;
  /** Dense 0..n index within the habit's routine. Ordering lives here, not in createdAt. */
  position: number;
  createdAt: number;
  updatedAt?: number;
}

export interface HabitDraft extends HabitSchedule, HabitGoal {
  name: string;
  reason?: string;
  icon?: string;
  sectionId?: string;
  reminderTimes: string[];
  constantReminder: boolean;
}

/**
 * A habit already decided on but not started, waiting on capacity. Not a goal:
 * a goal ends, a habit continues.
 */
export interface DesiredHabit {
  id: string;
  title: string;
  note?: string;
  /** The habit currently standing in for it, if any. */
  habitId?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface DesiredHabitDraft {
  title: string;
  note?: string;
}

export type HabitStatus = 'pending' | 'completed' | 'skipped';

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD format
  status: HabitStatus;
  /** Accumulated amount for quantity habits; 0 for boolean habits. */
  amount: number;
}

export interface HabitLogEntry {
  status: HabitStatus;
  amount: number;
}

// Todo types
export interface TodoList {
  id: string;
  name: string;
  color?: string;
  isInbox: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface TodoTag {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export type TodoStatus = 'open' | 'completed' | 'canceled';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface ChecklistItemDraft {
  /** Present when editing an existing item; omitted for new ones. */
  id?: string;
  title: string;
  done?: boolean;
}

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  status: TodoStatus;
  priority?: Priority;
  dueDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  estimateMinutes?: number;
  /** Minutes the task actually took, recorded when it is completed. */
  actualMinutes?: number;
  completedAt?: number;
  canceledAt?: number;
  /** The user's one manual order, dense per user; every drop rewrites it. */
  position: number;
  listId: string;
  goalId?: string;
  /** The single category this task belongs to. */
  tag?: TodoTag;
  /** Ordered checklist items; a task has a checklist iff this is non-empty. */
  checklist?: ChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface TodoDraft {
  title: string;
  notes?: string;
  priority?: Priority;
  dueDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  estimateMinutes?: number;
  listId?: string;
  listName?: string;
  goalId?: string;
  /** Category by id; `null` clears it. Takes precedence over tagName. */
  tagId?: string | null;
  /** Category by name; created if it doesn't exist yet. */
  tagName?: string | null;
  /**
   * Full checklist in order; plain strings create items. On update the array
   * replaces the existing list ([] clears it); items with an id are kept.
   */
  checklist?: string[] | ChecklistItemDraft[];
}

// Journal types
export type JournalMood = 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
export type JournalEntrySource = 'manual' | 'coach';

export interface JournalEntry {
  id: string;
  entryDate: string;
  content: string;
  mood?: JournalMood;
  source: JournalEntrySource;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntryDraft {
  entryDate?: string;
  content: string;
  mood?: JournalMood;
  source?: JournalEntrySource;
}

// Daily plan types
export type DailyPlanStatus = 'draft' | 'accepted' | 'superseded' | 'discarded';
export type DailyPlanSource = 'coach' | 'user';
export type DailyPlanItemType = 'habit' | 'todo' | 'note';
export type DailyPlanItemOutcome =
  | 'planned'
  | 'completed_as_planned'
  | 'completed_after_adjustment'
  | 'deferred'
  | 'removed'
  | 'canceled'
  | 'not_done';

export interface DailyPlanItem {
  id: string;
  planId: string;
  itemType: DailyPlanItemType;
  habitId?: string;
  todoId?: string;
  titleSnapshot: string;
  notesSnapshot?: string;
  scheduledTime?: string;
  estimateMinutesSnapshot?: number;
  isOptional: boolean;
  position: number;
  outcome: DailyPlanItemOutcome;
  resolvedAt?: number;
}

export interface DailyPlan {
  id: string;
  planDate: string;
  version: number;
  status: DailyPlanStatus;
  source: DailyPlanSource;
  parentPlanId?: string;
  rationale?: string;
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;
  items: DailyPlanItem[];
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Session types
export interface CoachingSession {
  isActive: boolean;
  startedAt: number;
  lastActiveAt: number;
  messages: ChatMessage[];
}

// Habit with today's status for display
export interface HabitWithStatus extends Habit {
  todayStatus: HabitStatus;
  todayAmount: number;
}

// Coach turn API (POST /api/chat, streamed as server-sent events)
export interface CoachTurnRequest {
  sessionId: string;
  /** The user's message, or a skill command such as `/coach` or `/plan-day`. */
  prompt: string;
  /** IANA timezone used for "today" and "now". */
  timezone: string;
  userName?: string;
}

/**
 * Hold-to-instruct (POST /api/instruct): one spoken instruction handled as a
 * proposal, then applied on confirmation — no coaching session row, no memories.
 * `propose` opens an Agent SDK session; `correct` and `apply` resume it.
 */
export type CoachInstructKind = 'propose' | 'correct' | 'apply';

export interface CoachInstructRequest {
  kind: CoachInstructKind;
  /** The transcribed instruction (`propose`) or correction (`correct`). */
  text?: string;
  /** The Agent SDK session the proposal turn returned; required for `correct` and `apply`. */
  claudeSessionId?: string;
  timezone: string;
  userName?: string;
}

export type CoachStreamEvent =
  | { type: 'session'; claudeSessionId: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string };

export interface ErrorResponse {
  error: string;
  code?: string;
}

// Memory types
export type MemoryCategory = 'motivation' | 'obstacle' | 'preference' | 'personal' | 'goal' | 'general';

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  sourceSessionAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Memory API types
export interface ExtractMemoriesRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface ExtractMemoriesResponse {
  memories: Array<{
    content: string;
    category: MemoryCategory;
  }>;
}

// Coaching Session Types
export interface CoachingSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** A day's ratings, as the app reads them. The coach owns the full row. */
export interface DayReviewSummary {
  reviewDate: string;
  happy?: number;
  energy?: number;
  momentum?: number;
  calm?: number;
  overall?: number;
}

/** How far a review got: the ratings, the one question, then the open lane. */
export type ReviewDepth = 'quick' | 'standard' | 'deep';

/** A review with the prose the day detail shows, on top of the ratings. */
export interface DayReviewDetail extends DayReviewSummary {
  highlight?: string;
  friction?: string;
  depth: ReviewDepth;
  reviewedAt: number;
}

/** The two daily coach practices. A session that is neither is a plain `coach` chat. */
export type RitualId = 'plan-day' | 'review-day';

/** The skill a session's first turn sends. */
export type SessionOpener = 'coach' | RitualId;

export interface CoachingSessionSummary {
  id: string;
  name: string | null;
  startedAt: number;
  endedAt: number | null;
  memoryCount?: number;
  opener: SessionOpener;
  /**
   * The day the ritual is *for*, which is not always the day it happened — a
   * review of last night done this morning belongs to last night. Null for a
   * plain chat.
   */
  ritualDate: string | null;
}

/**
 * The last coach turn the server ran for a session, and how it ended. A turn
 * outlives the socket that started it (iOS drops the stream when the app is
 * suspended), so the app reads the reply back from here on foreground.
 * Overwritten by the next turn, never cleared.
 */
export type CoachTurnRecord =
  | { prompt: string; status: 'running' }
  | { prompt: string; status: 'done'; reply: string }
  | { prompt: string; status: 'failed'; error: string };

export interface CoachingSessionDetail extends CoachingSessionSummary {
  messages: CoachingSessionMessage[];
  memories: Memory[];
  /** Null before the session's first turn. */
  lastTurn: CoachTurnRecord | null;
}

export interface CreateSessionRequest {
  startedAt?: number;  // Optional, defaults to now
  /** Defaults to `coach`. A ritual opener requires `ritualDate`. */
  opener?: SessionOpener;
  /** YYYY-MM-DD. With a ritual opener this finds the day's session or creates it. */
  ritualDate?: string;
}

export interface CreateSessionResponse {
  /** The whole session: for a ritual this may be the day's existing one, transcript and all. */
  session: CoachingSessionDetail;
}

export interface UpdateSessionRequest {
  messages?: CoachingSessionMessage[];
  name?: string;
  endedAt?: number | null;  // null reopens a finalized session
  isProcessed?: boolean;
}

export interface FinalizeSessionRequest {
  generateSummary?: boolean;  // Default true
  extractMemories?: boolean;  // Default true
}

export interface GetSessionsResponse {
  sessions: CoachingSessionSummary[];
}

export interface GetSessionResponse {
  session: CoachingSessionDetail;
}
