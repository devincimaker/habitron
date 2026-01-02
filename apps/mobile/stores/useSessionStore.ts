import { create } from 'zustand';
import { ChatMessage } from '@habits-coach/shared';
import { CONFIG } from '../config';
import { useMemoriesStore } from './useMemoriesStore';

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
    "Hi, I'm Sage - your habits coach. Before I can help you build meaningful habits, I'd love to understand you a bit better.\n\nWhat's on your mind today? What brought you here?",
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
    const { messages } = get();

    // Extract memories from the conversation (fire and forget)
    // Only extract if there were meaningful exchanges (more than just the welcome message)
    if (messages.length > 2) {
      const memoriesStore = useMemoriesStore.getState();
      memoriesStore.extractMemories(
        messages.map((m) => ({ role: m.role, content: m.content }))
      );
    }

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
