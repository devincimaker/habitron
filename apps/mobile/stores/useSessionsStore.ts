import { create } from 'zustand';
import type { CoachingSessionSummary, CoachingSessionDetail } from '@habits-coach/shared';
import * as sessionsService from '../services/sessions';
import { handleStoreAction } from './storeUtils';

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
    await handleStoreAction({
      action: async () => await sessionsService.getSessions(),
      onSuccess: (sessions) => set({ sessions }),
      context: 'load sessions',
      setState: (state) => set(state),
    });
  },

  loadSessionDetail: async (id: string) => {
    await handleStoreAction({
      action: async () => await sessionsService.getSession(id),
      onSuccess: (session) => set({ selectedSession: session }),
      context: 'load session detail',
      loadingKey: 'isLoadingDetail',
      setState: (state) => set(state),
    });
  },

  deleteSession: async (id: string) => {
    await handleStoreAction({
      action: async () => await sessionsService.deleteSession(id),
      onSuccess: () => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          selectedSession: state.selectedSession?.id === id ? null : state.selectedSession,
        }));
      },
      context: 'delete session',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
  },

  clearSelectedSession: () => {
    set({ selectedSession: null });
  },

  clearSessions: () => {
    set({ sessions: [], selectedSession: null });
  },
}));
