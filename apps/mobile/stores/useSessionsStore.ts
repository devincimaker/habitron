import { create } from 'zustand';
import type { CoachingSessionSummary } from '@habits-coach/shared';
import * as sessionsService from '../services/sessions';

interface SessionsState {
  sessions: CoachingSessionSummary[];
  isLoading: boolean;
  hasLoaded: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearSessions: () => void;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  isLoading: false,
  hasLoaded: false,

  loadSessions: async () => {
    if (!get().hasLoaded) {
      set({ isLoading: true });
    }
    try {
      const sessions = await sessionsService.getSessions();
      set({ sessions, isLoading: false, hasLoaded: true });
    } catch (error) {
      console.warn('Failed to load sessions:', error);
      set({ isLoading: false });
    }
  },

  deleteSession: async (id: string) => {
    const { sessions } = get();
    set({ sessions: sessions.filter((s) => s.id !== id) });

    try {
      await sessionsService.deleteSession(id);
    } catch (error) {
      console.warn('Failed to delete session:', error);
      set({ sessions });
      throw error;
    }
  },

  clearSessions: () => {
    set({ sessions: [], hasLoaded: false });
  },
}));
