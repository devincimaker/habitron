import { create } from 'zustand';
import { ChatMessage } from '@habits-coach/shared';
import * as Sentry from '@sentry/react-native';
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
  isCreatingSession: boolean;  // True while creating backend session

  // Actions
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<string>;
  updateMessage: (
    messageId: string,
    changes: Partial<Pick<ChatMessage, 'content' | 'proposal' | 'proposalStatus'>>
  ) => void;
  syncMessages: () => Promise<void>;  // Persist messages to backend
  setLoading: (loading: boolean) => void;
  checkAndRecoverSession: () => Promise<'recovered' | 'finalized' | 'none'>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function toMessagePayload(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));
}

const INITIAL_MESSAGE: Omit<ChatMessage, 'id' | 'timestamp'> = {
  role: 'assistant',
  content: "Hi, I'm Habitron - your habits coach. How are things going? What's on your mind today?",
};

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  sessionId: null,
  startedAt: null,
  lastActiveAt: null,
  messages: [],
  isLoading: false,
  isSyncing: false,
  isCreatingSession: false,

  startSession: async () => {
    // Prevent duplicate session starts from rapid taps
    if (get().isActive) return;

    const now = Date.now();
    const welcomeMessage: ChatMessage = {
      ...INITIAL_MESSAGE,
      id: generateId(),
      timestamp: now,
    };

    // Initialize local state only - backend session created on first user message
    // This prevents empty sessions from cluttering session history
    set({
      isActive: true,
      sessionId: null,
      startedAt: now,
      lastActiveAt: now,
      messages: [welcomeMessage],
      isLoading: false,
    });
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

    // Only finalize if session was persisted to backend (had user messages)
    // Sessions without user messages have no sessionId due to lazy creation
    if (sessionId) {
      try {
        await sessionsService.updateSession(sessionId, {
          messages: toMessagePayload(messages),
        });
        await sessionsService.finalizeSession(sessionId, {
          extractMemories: false,
        });
      } catch (error) {
        // Use warn to avoid red screen - session is ended locally regardless
        console.warn('Failed to finalize session:', error);
        Sentry.captureException(error, { tags: { feature: 'session' } });
      }
    }
  },

  addMessage: async (messageData) => {
    // Create backend session on first user message before we mutate local chat state.
    // If this fails, callers should treat the send as rejected rather than showing
    // a fake local-only conversation that cannot be persisted or orchestrated.
    if (messageData.role === 'user' && !get().sessionId) {
      if (get().isCreatingSession) {
        throw new Error('Session creation already in progress');
      }

      set({ isCreatingSession: true });
      try {
        const { id } = await sessionsService.createSession();
        set({ sessionId: id });
      } catch (error) {
        console.warn('Failed to create session in backend:', error);
        Sentry.captureException(error, { tags: { feature: 'session' } });
        throw error;
      } finally {
        set({ isCreatingSession: false });
      }
    }

    const message: ChatMessage = {
      ...messageData,
      id: generateId(),
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, message],
      lastActiveAt: Date.now(),
    }));

    // Sync to backend (only if we have a sessionId)
    if (get().sessionId) {
      await get().syncMessages();
    }

    return message.id;
  },

  updateMessage: (messageId, changes) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              ...changes,
            }
          : message
      ),
    }));
  },

  syncMessages: async () => {
    const { sessionId, messages, isSyncing } = get();

    if (!sessionId || isSyncing) return;

    set({ isSyncing: true });
    try {
      await sessionsService.updateSession(sessionId, {
        messages: toMessagePayload(messages),
      });
    } catch (error) {
      // Use warn to avoid red screen - messages are stored locally
      console.warn('Failed to sync messages:', error);
      Sentry.captureException(error, { tags: { feature: 'session' } });
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

      // Finalize orphaned session - outside 10 minute window
      if (elapsed >= SESSION_RECOVERY_WINDOW_MS) {
        await sessionsService.finalizeSession(activeSession.id, {
          extractMemories: false,
        });
        return 'finalized';
      }

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
    } catch (error) {
      // Use warn instead of error to avoid red screen in dev mode
      // This is not critical - we can just start a new session
      console.warn('Failed to check/recover session:', error);
      Sentry.captureException(error, { tags: { feature: 'session' } });
      return 'none';
    }
  },
}));
