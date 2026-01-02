import { create } from 'zustand';
import { ChatMessage } from '@habits-coach/shared';
import { CONFIG } from '../config';

interface SessionState {
  isActive: boolean;
  startedAt: number | null;
  lastActiveAt: number | null;
  messages: ChatMessage[];
  isLoading: boolean;

  // Actions
  startSession: () => void;
  endSession: () => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setLoading: (loading: boolean) => void;
  updateLastActive: () => void;
  checkSessionTimeout: () => boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi, I'm Sage - your habits coach. How are things going? What's on your mind today?",
  timestamp: Date.now(),
};

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  startedAt: null,
  lastActiveAt: null,
  messages: [],
  isLoading: false,

  startSession: () => {
    const now = Date.now();
    set({
      isActive: true,
      startedAt: now,
      lastActiveAt: now,
      messages: [{ ...INITIAL_MESSAGE, id: generateId(), timestamp: now }],
      isLoading: false,
    });
  },

  endSession: () => {
    set({
      isActive: false,
      startedAt: null,
      lastActiveAt: null,
      messages: [],
      isLoading: false,
    });
  },

  addMessage: (messageData) => {
    const message: ChatMessage = {
      ...messageData,
      id: generateId(),
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, message],
      lastActiveAt: Date.now(),
    }));
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  updateLastActive: () => {
    set({ lastActiveAt: Date.now() });
  },

  checkSessionTimeout: () => {
    const { isActive, lastActiveAt } = get();
    if (!isActive || !lastActiveAt) return false;

    const now = Date.now();
    const elapsed = now - lastActiveAt;

    if (elapsed > CONFIG.SESSION_TIMEOUT_MS) {
      // Session has timed out
      get().endSession();
      return true;
    }

    return false;
  },
}));
