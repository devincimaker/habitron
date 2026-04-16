// User Profile types
export interface UserProfile {
  id: string;
  userId: string;
  name: string | null;
  createdAt: number;
  updatedAt: number;
}

export type HabitFrequency = 'daily' | 'weekly';
export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type TimeBlock = 'morning' | 'afternoon' | 'evening';
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
export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  weeklyDays?: HabitWeekday[];
  weeklyCount?: number;
  timeOfDay?: HabitTimeOfDay;
  reason?: string;
  icon?: string;
  active: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface HabitDraft {
  name: string;
  frequency: HabitFrequency;
  weeklyDays?: HabitWeekday[];
  weeklyCount?: number;
  timeOfDay?: HabitTimeOfDay;
  reason?: string;
  icon?: string;
}

export type HabitStatus = 'pending' | 'completed' | 'skipped';

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD format
  status: HabitStatus;
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

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  status: TodoStatus;
  priority?: Priority;
  dueDate?: string;
  scheduledDate?: string;
  scheduledBlock?: TimeBlock;
  estimateMinutes?: number;
  completedAt?: number;
  canceledAt?: number;
  sortOrder: number;
  listId: string;
  goalId?: string;
  tags: TodoTag[];
  createdAt: number;
  updatedAt: number;
}

export interface TodoDraft {
  title: string;
  notes?: string;
  priority?: Priority;
  dueDate?: string;
  scheduledDate?: string;
  scheduledBlock?: TimeBlock;
  estimateMinutes?: number;
  listId?: string;
  listName?: string;
  goalId?: string;
  tagIds?: string[];
  tagNames?: string[];
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
  scheduledBlock: TimeBlock;
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
  scheduledBlock: TimeBlock;
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
      habit: HabitDraft;
    }
  | {
      entity: 'habit';
      operation: 'edit';
      habitId: string;
      changes: Partial<HabitDraft>;
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
      scheduledBlock?: TimeBlock;
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

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: CoachProposal;
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
}

// API types
export interface ChatRequest {
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
  messageCount: number;
  memoryCount?: number;
}

export interface CoachingSessionDetail extends CoachingSessionSummary {
  messages: CoachingSessionMessage[];
  memories: Memory[];
}

export interface CreateSessionRequest {
  startedAt?: number;  // Optional, defaults to now
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
  endedAt?: number;
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

export type HabitAction = Extract<CoachAction, { entity: 'habit' }>;
