// Habit types
export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  reason?: string;
  createdAt: number;
}

export type HabitStatus = 'pending' | 'completed' | 'skipped';

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD format
  status: HabitStatus;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: HabitAction;
  timestamp: number;
}

// AI response types
export interface HabitAction {
  type: 'add' | 'remove' | 'edit';
  habit: {
    id?: string; // Required for 'remove' and 'edit'
    name: string;
    frequency: 'daily' | 'weekly';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
    reason: string;
  };
}

export interface AIResponse {
  message: string;
  action?: HabitAction;
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
  habits: Array<{
    id: string;
    name: string;
    frequency: 'daily' | 'weekly';
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
    reason?: string;
  }>;
}

export interface ChatResponse {
  message: string;
  action?: HabitAction;
}

export interface ErrorResponse {
  error: string;
  code?: string;
}
