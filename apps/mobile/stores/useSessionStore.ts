import { create } from 'zustand';
import type { ChatMessage, CoachingSessionDetail } from '@habits-coach/shared';
import * as Sentry from '@sentry/react-native';
import * as sessionsService from '../services/sessions';
import { deriveSessionName } from '../utils/sessionName';

interface SessionState {
  isActive: boolean;
  sessionId: string | null;  // Backend session ID
  startedAt: number | null;
  endedAt: number | null;  // Set when a finalized session was opened from the hub
  lastActiveAt: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSyncing: boolean;  // True while syncing to backend
  isCreatingSession: boolean;  // True while creating backend session

  // Actions
  startSession: () => Promise<void>;
  hydrateSession: (session: CoachingSessionDetail) => void;
  leaveSession: () => Promise<void>;
  endSession: () => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<string>;
  updateMessage: (
    messageId: string,
    changes: Partial<Pick<ChatMessage, 'content' | 'proposal' | 'proposalStatus'>>
  ) => void;
  syncMessages: () => Promise<void>;  // Persist messages to backend
  setLoading: (loading: boolean) => void;
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

const EMPTY_STATE: Pick<
  SessionState,
  'isActive' | 'sessionId' | 'startedAt' | 'endedAt' | 'lastActiveAt' | 'messages' | 'isLoading'
> = {
  isActive: false,
  sessionId: null,
  startedAt: null,
  endedAt: null,
  lastActiveAt: null,
  messages: [],
  isLoading: false,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...EMPTY_STATE,
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
      ...EMPTY_STATE,
      isActive: true,
      startedAt: now,
      lastActiveAt: now,
      messages: [welcomeMessage],
    });
  },

  hydrateSession: (session) => {
    const messages: ChatMessage[] = session.messages.map((m, i) => ({
      id: `${session.id}-${i}-${m.timestamp}`,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

    set({
      ...EMPTY_STATE,
      isActive: true,
      sessionId: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      lastActiveAt: messages[messages.length - 1]?.timestamp ?? session.startedAt,
      messages: messages.length > 0
        ? messages
        : [{ ...INITIAL_MESSAGE, id: generateId(), timestamp: session.startedAt }],
    });
  },

  leaveSession: async () => {
    // Leaving is not ending: persist what was said and let the session stay open.
    await get().syncMessages();
    set(EMPTY_STATE);
  },

  endSession: async () => {
    const { sessionId, messages } = get();

    // Clear local state
    set(EMPTY_STATE);

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
    // The backend session is created on the first user message, and a finalized
    // session opened from the hub is reopened on the first new one. If either
    // fails, callers should treat the send as rejected rather than showing a
    // local-only turn that cannot be persisted or orchestrated.
    if (messageData.role === 'user' && (!get().sessionId || get().endedAt !== null)) {
      if (get().isCreatingSession) {
        throw new Error('Session creation already in progress');
      }

      set({ isCreatingSession: true });
      try {
        const { sessionId } = get();
        if (sessionId) {
          await sessionsService.updateSession(sessionId, { endedAt: null, isProcessed: false });
          set({ endedAt: null });
        } else {
          const { id } = await sessionsService.createSession({
            name: deriveSessionName(messageData.content) ?? undefined,
          });
          set({ sessionId: id });
        }
      } catch (error) {
        console.warn('Failed to open session in backend:', error);
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
}));
