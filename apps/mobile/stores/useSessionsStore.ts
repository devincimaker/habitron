import { create } from 'zustand';
import type { CoachingSessionSummary, CoachingSessionDetail } from '@habits-coach/shared';
import * as sessionsService from '../services/sessions';

interface SessionsState {
  sessions: CoachingSessionSummary[];
  isLoading: boolean;
  selectedSession: CoachingSessionDetail | null;
  isLoadingDetail: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  loadSessionDetail: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearSelectedSession: () => void;
  clearSessions: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  isLoading: false,
  selectedSession: null,
  isLoadingDetail: false,

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const sessions = await sessionsService.getSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      console.error('Failed to load sessions:', error);
      set({ isLoading: false });
    }
  },

  loadSessionDetail: async (id: string) => {
    set({ isLoadingDetail: true });
    try {
      const session = await sessionsService.getSession(id);
      set({ selectedSession: session, isLoadingDetail: false });
    } catch (error) {
      console.error('Failed to load session detail:', error);
      set({ isLoadingDetail: false });
    }
  },

  deleteSession: async (id: string) => {
    try {
      await sessionsService.deleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        selectedSession: state.selectedSession?.id === id ? null : state.selectedSession,
      }));
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  },

  clearSelectedSession: () => {
    set({ selectedSession: null });
  },

  clearSessions: () => {
    set({ sessions: [], selectedSession: null });
  },
}));
