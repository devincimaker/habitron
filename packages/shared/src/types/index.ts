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
  autoPopupLog: boolean;
  active: boolean;
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
  autoPopupLog: boolean;
}

/** The habit fields the coach is allowed to propose; the rest take defaults. */
export type CoachHabitDraft = Pick<
  HabitDraft,
  'name' | 'frequency' | 'weeklyDays' | 'weeklyCount' | 'intervalDays' | 'reason' | 'icon'
>;

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
  sortOrder: number;
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

export type DailyPlanDraftItemRef =
  | { kind: 'habit'; id: string }
  | { kind: 'todo'; id: string }
  | { kind: 'action'; clientKey: string };

export interface DailyPlanDraftItem {
  itemType: DailyPlanItemType;
  ref?: DailyPlanDraftItemRef;
  title: string;
  notes?: string;
  scheduledTime: string;
  estimateMinutes?: number;
  isOptional?: boolean;
}

export interface DailyPlanDraft {
  date: string;
  rationale?: string;
  items: DailyPlanDraftItem[];
}

// Coach action types
export type CoachAction =
  | {
      entity: 'goal';
      operation: 'add';
      clientKey?: string;
      goal: GoalDraft;
    }
  | {
      entity: 'goal';
      operation: 'edit';
      goalId: string;
      changes: Partial<GoalDraft>;
    }
  | {
      entity: 'goal';
      operation: 'archive';
      goalId: string;
    }
  | {
      entity: 'habit';
      operation: 'add';
      clientKey?: string;
      habit: CoachHabitDraft;
    }
  | {
      entity: 'habit';
      operation: 'edit';
      habitId: string;
      changes: Partial<CoachHabitDraft>;
    }
  | {
      entity: 'habit';
      operation: 'archive';
      habitId: string;
    }
  | {
      entity: 'habit';
      operation: 'remove';
      habitId: string;
    }
  | {
      entity: 'todo';
      operation: 'add';
      clientKey?: string;
      todo: TodoDraft;
    }
  | {
      entity: 'todo';
      operation: 'edit';
      todoId: string;
      changes: Partial<TodoDraft>;
    }
  | {
      entity: 'todo';
      operation: 'schedule';
      todoId: string;
      scheduledDate: string;
      scheduledTime?: string;
    }
  | {
      entity: 'todo';
      operation: 'unschedule';
      todoId: string;
    }
  | {
      entity: 'todo';
      operation: 'complete' | 'cancel' | 'reopen' | 'remove';
      todoId: string;
    }
  | {
      entity: 'journal' | 'diary';
      operation: 'create';
      clientKey?: string;
      entry: JournalEntryDraft;
    };

export interface CoachProposal {
  actions: CoachAction[];
  dailyPlanDraft?: DailyPlanDraft | null;
}

export type CoachSkillId =
  | 'general-coach'
  | 'day-planning'
  | 'task-management'
  | 'habit-design';
export type CoachingSkillStatus = 'active' | 'paused' | 'completed';

export interface CoachingSkillInstance {
  id: string;
  skillId: CoachSkillId;
  status: CoachingSkillStatus;
  isLead: boolean;
  phase: string | null;
  state: Record<string, unknown>;
  activatedAt: number;
  lastUsedAt: number;
  completedAt: number | null;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: CoachProposal;
  proposalStatus?: 'pending' | 'applying' | 'applied' | 'dismissed' | 'failed';
  timestamp: number;
}

// AI response types
export interface AIResponse {
  message: string;
  proposal?: CoachProposal | null;
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

// API types
export interface ChatRequest {
  sessionId?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  habits: Habit[];
  goals?: Goal[];
  todos?: Todo[];
  journalEntries?: JournalEntry[];
  dailyPlan?: DailyPlan | null;
  memories?: Array<{
    content: string;
    category: MemoryCategory;
  }>;
  userName?: string;
  today?: string;
  timezone?: string;
}

export interface ChatResponse {
  message: string;
  proposal?: CoachProposal | null;
  leadSkillId?: CoachSkillId;
  activeSkillIds?: CoachSkillId[];
  skillPhase?: string | null;
}

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

export interface CoachingSessionSummary {
  id: string;
  name: string | null;
  startedAt: number;
  endedAt: number | null;
  memoryCount?: number;
  leadSkillId?: CoachSkillId | null;
}

export interface CoachingSessionDetail extends CoachingSessionSummary {
  messages: CoachingSessionMessage[];
  memories: Memory[];
  activeSkills?: CoachingSkillInstance[];
}

export interface CreateSessionRequest {
  startedAt?: number;  // Optional, defaults to now
  name?: string;  // Provisional name; finalize replaces it with a generated summary
}

export interface CreateSessionResponse {
  session: {
    id: string;
    startedAt: number;
  };
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

export interface UpdateSessionSkillRequest {
  phase?: string | null;
  status?: CoachingSkillStatus;
  isLead?: boolean;
  statePatch?: Record<string, unknown>;
}

export interface GetSessionsResponse {
  sessions: CoachingSessionSummary[];
}

export interface GetSessionResponse {
  session: CoachingSessionDetail;
}

export type HabitAction = Extract<CoachAction, { entity: 'habit' }>;

export type CoachDebugEventType =
  | 'chat_request_sent'
  | 'chat_response_received'
  | 'chat_response_rejected'
  | 'proposal_received'
  | 'proposal_apply_started'
  | 'proposal_apply_succeeded'
  | 'proposal_apply_failed'
  | 'session_sync_failed';

export type CoachDebugErrorStage =
  | 'chat_generation'
  | 'chat_response_parse'
  | 'chat_response_validation'
  | 'proposal_validation'
  | 'proposal_apply'
  | 'session_sync'
  | 'session_finalize'
  | 'unknown';

export interface CoachDebugEventInput {
  eventType: CoachDebugEventType;
  turnIndex?: number;
  requestPayload?: JsonValue | null;
  responsePayload?: JsonValue | null;
  proposalPayload?: CoachProposal | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  errorStage?: CoachDebugErrorStage | null;
  metadata?: JsonValue | null;
}

export interface CoachDebugEvent extends CoachDebugEventInput {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: number;
}

export interface CreateCoachDebugEventRequest {
  event: CoachDebugEventInput;
}

export interface CreateCoachDebugEventResponse {
  event: CoachDebugEvent;
}

export interface GetCoachDebugEventsResponse {
  events: CoachDebugEvent[];
}
