import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface ProfileState {
  name: string | null;
  dailyReminderEnabled: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  loadProfile: () => Promise<void>;
  updateName: (name: string) => Promise<{ error: Error | null }>;
  updateDailyReminder: (enabled: boolean) => Promise<{ error: Error | null }>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  name: null,
  dailyReminderEnabled: true,
  isLoading: false,
  isInitialized: false,

  loadProfile: async () => {
    set({ isLoading: true });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ isLoading: false, isInitialized: true });
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('name, daily_reminder_enabled')
      .eq('user_id', user.id)
      .single();

    // PGRST116 = "no rows returned" which is fine for new users
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading profile:', error);
    }

    set({
      name: data?.name ?? null,
      dailyReminderEnabled: data?.daily_reminder_enabled ?? true,
      isLoading: false,
      isInitialized: true,
    });
  },

  updateName: async (name: string) => {
    set({ isLoading: true });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ isLoading: false });
      return { error: new Error('Not authenticated') };
    }

    const trimmedName = name.trim();
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, name: trimmedName },
        { onConflict: 'user_id' }
      );

    if (error) {
      set({ isLoading: false });
      return { error };
    }

    set({ name: trimmedName, isLoading: false });
    return { error: null };
  },

  updateDailyReminder: async (enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, daily_reminder_enabled: enabled },
        { onConflict: 'user_id' }
      );

    if (error) {
      return { error };
    }

    set({ dailyReminderEnabled: enabled });
    return { error: null };
  },

  reset: () => {
    set({ name: null, dailyReminderEnabled: true, isLoading: false, isInitialized: false });
  },
}));
