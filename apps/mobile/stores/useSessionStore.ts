import { create } from 'zustand';
import type { ChatMessage, CoachingSessionDetail, UpdateSessionRequest } from '@habits-coach/shared';
import * as Sentry from '@sentry/react-native';
import * as sessionsService from '../services/sessions';
import { deriveSessionName } from '../utils/sessionName';

interface SessionState {
  isActive: boolean;
  sessionId: string | null;  // Backend session ID
  name: string | null;  // Provisional until finalize generates a summary
  startedAt: number | null;
  endedAt: number | null;  // Set when a finalized session was opened from the hub
  lastActiveAt: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSyncing: boolean;  // True while syncing to backend
  startError: string | null;  // Set when the backend session could not be created

  // Actions
  startSession: () => Promise<void>;
  /** Opens a session from the hub in place: transcript, identity, and whether it was ended. */
  hydrateSession: (session: CoachingSessionDetail) => void;
  /** The backend session id, creating the session if needed. Throws when the backend is unreachable. */
  ensureBackendSession: () => Promise<string>;
  /** Leaves without ending: the transcript is persisted and the session stays open. */
  leaveSession: () => Promise<void>;
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

const EMPTY_STATE: Pick<
  SessionState,
  | 'isActive'
  | 'sessionId'
  | 'name'
  | 'startedAt'
  | 'endedAt'
  | 'lastActiveAt'
  | 'messages'
  | 'isLoading'
  | 'startError'
> = {
  isActive: false,
  sessionId: null,
  name: null,
  startedAt: null,
  endedAt: null,
  lastActiveAt: null,
  messages: [],
  isLoading: false,
  startError: null,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...EMPTY_STATE,
  isSyncing: false,

  startSession: async () => {
    // Prevent duplicate session starts from rapid taps
    if (get().isActive) return;

    const now = Date.now();
    set({
      ...EMPTY_STATE,
      isActive: true,
      startedAt: now,
      lastActiveAt: now,
    });

    // The coach speaks first, so the backend session exists from the start.
    try {
      await get().ensureBackendSession();
    } catch {
      // startError is set; the screen offers a retry.
    }
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
      name: session.name,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      lastActiveAt: messages[messages.length - 1]?.timestamp ?? session.startedAt,
      messages,
    });
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

  leaveSession: async () => {
    const { sessionId, messages } = get();

    set(EMPTY_STATE);

    if (!sessionId) return;

    try {
      if (hasUserMessages(messages)) {
        await sessionsService.updateSession(sessionId, {
          messages: toMessagePayload(messages),
        });
      } else {
        // Only the coach's opener happened: nothing worth keeping open.
        await sessionsService.deleteSession(sessionId);
      }
    } catch (error) {
      console.warn('Failed to leave session:', error);
      Sentry.captureException(error, { tags: { feature: 'session' } });
    }
  },

  endSession: async () => {
    const { sessionId, messages } = get();

    set(EMPTY_STATE);

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
    // The first user message names the session so it reads in the hub while
    // open, and reopens a finalized session that was resumed from the hub. If
    // that write fails the send is rejected, so the turn never runs against a
    // session the backend still considers closed.
    const { sessionId, endedAt, name } = get();
    if (messageData.role === 'user' && sessionId && (endedAt !== null || name === null)) {
      const updates: UpdateSessionRequest = {};
      if (endedAt !== null) {
        updates.endedAt = null;
        updates.isProcessed = false;
      }
      if (name === null) {
        updates.name = deriveSessionName(messageData.content) ?? undefined;
      }

      try {
        await sessionsService.updateSession(sessionId, updates);
        set({ endedAt: null, name: updates.name ?? name });
      } catch (error) {
        console.warn('Failed to open session in backend:', error);
        Sentry.captureException(error, { tags: { feature: 'session' } });
        throw error;
      }
    }

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
}));
