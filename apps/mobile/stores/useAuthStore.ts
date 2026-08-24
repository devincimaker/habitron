import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../services/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isInitialized: true,
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      Sentry.captureException(error, { tags: { feature: 'auth' } });
      set({ isLoading: false, isInitialized: true });
    }
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false });
      return { error };
    }

    set({
      session: data.session,
      user: data.user,
      isLoading: false,
    });

    return { error: null };
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false });
      return { error };
    }

    set({
      session: data.session,
      user: data.user,
      isLoading: false,
    });

    return { error: null };
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      isLoading: false,
    });
  },

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },
}));
