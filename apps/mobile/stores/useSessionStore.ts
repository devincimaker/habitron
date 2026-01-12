import { create } from 'zustand';
import { ChatMessage } from '@habits-coach/shared';
import * as sessionsService from '../services/sessions';

const SESSION_RECOVERY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface SessionState {
  isActive: boolean;
  sessionId: string | null;  // Backend session ID
  startedAt: number | null;
  lastActiveAt: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSyncing: boolean;  // True while syncing to backend

  // Actions
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  syncMessages: () => Promise<void>;  // Persist messages to backend
  setLoading: (loading: boolean) => void;
  checkAndRecoverSession: () => Promise<'recovered' | 'finalized' | 'none'>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const INITIAL_MESSAGE: Omit<ChatMessage, 'id' | 'timestamp'> = {
  role: 'assistant',
  content: "Hi, I'm Sage - your habits coach. How are things going? What's on your mind today?",
};

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  sessionId: null,
  startedAt: null,
  lastActiveAt: null,
  messages: [],
  isLoading: false,
  isSyncing: false,

  startSession: async () => {
    const now = Date.now();
    const welcomeMessage: ChatMessage = {
      ...INITIAL_MESSAGE,
      id: generateId(),
      timestamp: now,
    };

    // Optimistically set local state
    set({
      isActive: true,
      startedAt: now,
      lastActiveAt: now,
      messages: [welcomeMessage],
      isLoading: false,
    });

    // Create session in backend
    try {
      const { id } = await sessionsService.createSession();
      set({ sessionId: id });

      // Sync the welcome message
      await get().syncMessages();
    } catch (error) {
      console.error('Failed to create session in backend:', error);
      // Continue with local-only session, will try to sync later
    }
  },

  endSession: async () => {
    const { sessionId, messages } = get();

    // Clear local state
    set({
      isActive: false,
      sessionId: null,
      startedAt: null,
      lastActiveAt: null,
      messages: [],
      isLoading: false,
    });

    // Finalize in backend if we have a session ID
    if (sessionId && messages.length > 0) {
      try {
        // Sync final messages first
        await sessionsService.updateSession(sessionId, {
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
        });

        // Then finalize
        await sessionsService.finalizeSession(sessionId);
      } catch (error) {
        console.error('Failed to finalize session:', error);
      }
    }
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

    // Sync to backend (fire and forget, will retry on next message if failed)
    get().syncMessages();
  },

  syncMessages: async () => {
    const { sessionId, messages, isSyncing } = get();

    if (!sessionId || isSyncing) return;

    set({ isSyncing: true });
    try {
      await sessionsService.updateSession(sessionId, {
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      });
    } catch (error) {
      console.error('Failed to sync messages:', error);
    } finally {
      set({ isSyncing: false });
    }
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  checkAndRecoverSession: async () => {
    try {
      const activeSession = await sessionsService.getActiveSession();

      if (!activeSession) {
        return 'none';
      }

      const now = Date.now();
      const elapsed = now - activeSession.updatedAt;

      if (elapsed < SESSION_RECOVERY_WINDOW_MS) {
        // Recover session - within 10 minute window
        const messages: ChatMessage[] = activeSession.messages.map((m, i) => ({
          id: `recovered-${i}-${m.timestamp}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

        set({
          isActive: true,
          sessionId: activeSession.id,
          startedAt: activeSession.startedAt,
          lastActiveAt: activeSession.updatedAt,
          messages,
          isLoading: false,
        });

        return 'recovered';
      } else {
        // Finalize orphaned session - outside 10 minute window
        await sessionsService.finalizeSession(activeSession.id);
        return 'finalized';
      }
    } catch (error) {
      console.error('Failed to check/recover session:', error);
      return 'none';
    }
  },
}));
