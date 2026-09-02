import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../services/supabase';
import { useAuthStore } from './useAuthStore';

/**
 * 'ready' means the profile fetch completed (possibly with no row yet,
 * for new users). 'error' means the fetch failed and the data is
 * unknown — routing must not treat this as "new user".
 */
export type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ProfileState {
  name: string | null;
  dailyReminderEnabled: boolean;
  loadStatus: ProfileLoadStatus;
  isSaving: boolean;

  // Actions
  loadProfile: () => Promise<void>;
  updateName: (name: string) => Promise<{ error: Error | null }>;
  updateDailyReminder: (enabled: boolean) => Promise<{ error: Error | null }>;
  reset: () => void;
}

/** The signed-in user's id, from the already-restored auth session (no network). */
function sessionUserId(): string | null {
  return useAuthStore.getState().session?.user?.id ?? null;
}

async function upsertProfile(
  userId: string,
  fields: { name?: string; daily_reminder_enabled?: boolean }
): Promise<Error | null> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' });
    return error ? new Error(error.message) : null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  name: null,
  dailyReminderEnabled: true,
  loadStatus: 'idle',
  isSaving: false,

  loadProfile: async () => {
    set({ loadStatus: 'loading' });

    try {
      const userId = sessionUserId();
      if (!userId) {
        // Signed out: routing sends this to login, not onboarding.
        set({ name: null, dailyReminderEnabled: true, loadStatus: 'ready' });
        return;
      }

      // maybeSingle: 0 rows is data=null with NO error (a new user),
      // so any error here is a real failure.
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, daily_reminder_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load profile: ${error.message}`);
      }

      set({
        name: data?.name ?? null,
        dailyReminderEnabled: data?.daily_reminder_enabled ?? true,
        loadStatus: 'ready',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      Sentry.captureException(error, { tags: { feature: 'profile' } });
      // Keep any previously loaded name; only the status changes.
      set({ loadStatus: 'error' });
    }
  },

  updateName: async (name: string) => {
    const userId = sessionUserId();
    if (!userId) {
      return { error: new Error('Not authenticated') };
    }

    const trimmedName = name.trim();
    const previous = get().name;
    set({ name: trimmedName, isSaving: true });
    const error = await upsertProfile(userId, { name: trimmedName });
    set(error ? { name: previous, isSaving: false } : { isSaving: false });
    return { error };
  },

  updateDailyReminder: async (enabled: boolean) => {
    const userId = sessionUserId();
    if (!userId) {
      return { error: new Error('Not authenticated') };
    }

    // The switch flips at once; a failed write flips it back.
    const previous = get().dailyReminderEnabled;
    set({ dailyReminderEnabled: enabled });
    const error = await upsertProfile(userId, { daily_reminder_enabled: enabled });
    if (error) {
      set({ dailyReminderEnabled: previous });
    }
    return { error };
  },

  reset: () => {
    set({ name: null, dailyReminderEnabled: true, loadStatus: 'idle', isSaving: false });
  },
}));
