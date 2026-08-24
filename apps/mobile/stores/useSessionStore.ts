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
  startError: string | null;  // Set when the backend session could not be created

  // Actions
  startSession: () => Promise<void>;
  /** The backend session id, creating the session if needed. Throws when the backend is unreachable. */
  ensureBackendSession: () => Promise<string>;
  endSession: () => Promise<void>;
  /** Adds a message locally only; returns its id. */
  addLocalMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  /** Adds a message and syncs the transcript to the backend; returns its id. */
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<string>;
  appendToMessage: (messageId: string, delta: string) => void;
  /** Replaces a message's content (e.g. the canonical text after streaming) and syncs. */
  finalizeMessage: (messageId: string, content: string) => Promise<void>;
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

function hasUserMessages(messages: Pick<ChatMessage, 'role'>[]): boolean {
  return messages.some((message) => message.role === 'user');
}

let pendingSessionCreation: Promise<string> | null = null;

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  sessionId: null,
  startedAt: null,
  lastActiveAt: null,
  messages: [],
  isLoading: false,
  isSyncing: false,
  startError: null,

  startSession: async () => {
    // Prevent duplicate session starts from rapid taps
    if (get().isActive) return;

    const now = Date.now();
    set({
      isActive: true,
      sessionId: null,
      startedAt: now,
      lastActiveAt: now,
      messages: [],
      isLoading: false,
      startError: null,
    });

    // The coach speaks first, so the backend session exists from the start.
    try {
      await get().ensureBackendSession();
    } catch {
      // startError is set; the screen offers a retry.
    }
  },

  ensureBackendSession: async () => {
    const existing = get().sessionId;
    if (existing) return existing;

    if (!pendingSessionCreation) {
      pendingSessionCreation = sessionsService
        .createSession()
        .then(({ id }) => {
          set({ sessionId: id, startError: null });
          return id;
        })
        .catch((error) => {
          console.warn('Failed to create session in backend:', error);
          Sentry.captureException(error, { tags: { feature: 'session' } });
          set({ startError: error instanceof Error ? error.message : 'Failed to create session' });
          throw error;
        })
        .finally(() => {
          pendingSessionCreation = null;
        });
    }

    return pendingSessionCreation;
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
      startError: null,
    });

    if (!sessionId) return;

    try {
      if (hasUserMessages(messages)) {
        await sessionsService.updateSession(sessionId, {
          messages: toMessagePayload(messages),
        });
        await sessionsService.finalizeSession(sessionId, {
          extractMemories: false,
        });
      } else {
        // Only the coach's opener happened: nothing worth keeping in history.
        await sessionsService.deleteSession(sessionId);
      }
    } catch (error) {
      // Use warn to avoid red screen - session is ended locally regardless
      console.warn('Failed to finalize session:', error);
      Sentry.captureException(error, { tags: { feature: 'session' } });
    }
  },

  addLocalMessage: (messageData) => {
    const message: ChatMessage = {
      ...messageData,
      id: generateId(),
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, message],
      lastActiveAt: Date.now(),
    }));

    return message.id;
  },

  addMessage: async (messageData) => {
    const id = get().addLocalMessage(messageData);
    await get().syncMessages();
    return id;
  },

  appendToMessage: (messageId, delta) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, content: message.content + delta } : message
      ),
      lastActiveAt: Date.now(),
    }));
  },

  finalizeMessage: async (messageId, content) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, content } : message
      ),
      lastActiveAt: Date.now(),
    }));
    await get().syncMessages();
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

      // Orphaned session - outside the 10 minute window
      if (elapsed >= SESSION_RECOVERY_WINDOW_MS) {
        if (hasUserMessages(activeSession.messages)) {
          await sessionsService.finalizeSession(activeSession.id, {
            extractMemories: false,
          });
        } else {
          await sessionsService.deleteSession(activeSession.id);
        }
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
        startError: null,
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
