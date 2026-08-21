/**
 * Profile Store Tests
 *
 * These tests verify the user profile store behavior:
 * - Loading profile data from Supabase, with a load status that
 *   distinguishes "new user, no profile row" from "fetch failed"
 * - Updating the user's name and daily reminder
 * - Proper state management and error handling
 *
 * Regression (2026-08-21): a failed profile fetch used to be reported
 * as an initialized profile with name=null, which routed existing
 * users back into onboarding. A failure must surface as
 * loadStatus='error' and preserve any previously loaded name.
 */

// Mock Supabase before importing the store
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../services/supabase', () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => {
        mockSelect(columns);
        return {
          eq: (column: string, value: string) => {
            mockEq(column, value);
            return {
              maybeSingle: () => mockMaybeSingle(),
            };
          },
        };
      },
      upsert: (data: unknown, options: unknown) => mockUpsert(data, options),
    }),
  },
}));

import { useProfileStore } from '../stores/useProfileStore';
import { useAuthStore } from '../stores/useAuthStore';

describe('useProfileStore', () => {
  const mockUserId = 'user-123';

  const signIn = () => {
    useAuthStore.setState({
      session: { user: { id: mockUserId } } as never,
    });
  };

  const signOut = () => {
    useAuthStore.setState({ session: null });
  };

  beforeEach(() => {
    // Reset store state before each test
    useProfileStore.setState({
      name: null,
      dailyReminderEnabled: true,
      loadStatus: 'idle',
      isSaving: false,
    });
    signIn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('loadProfile', () => {
    it('should load profile name from Supabase', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { name: 'John', daily_reminder_enabled: false },
        error: null,
      });

      await useProfileStore.getState().loadProfile();

      expect(mockSelect).toHaveBeenCalledWith('name, daily_reminder_enabled');
      expect(mockEq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(useProfileStore.getState().name).toBe('John');
      expect(useProfileStore.getState().dailyReminderEnabled).toBe(false);
      expect(useProfileStore.getState().loadStatus).toBe('ready');
    });

    it('should treat a missing profile row as a ready profile with no name (new user)', async () => {
      // maybeSingle returns data=null with no error when there is no row
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().loadStatus).toBe('ready');
    });

    it('should handle signed-out state without querying', async () => {
      signOut();

      await useProfileStore.getState().loadProfile();

      expect(mockMaybeSingle).not.toHaveBeenCalled();
      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().loadStatus).toBe('ready');
    });

    /**
     * REGRESSION: a query error must NOT look like "new user".
     */
    it('should set loadStatus=error (not ready) when the query fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' },
      });

      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().loadStatus).toBe('error');
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    /**
     * REGRESSION: a failed refresh must not wipe a previously loaded name.
     */
    it('should preserve a previously loaded name when a refresh fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      useProfileStore.setState({ name: 'John', loadStatus: 'ready' });

      mockMaybeSingle.mockRejectedValue(new Error('Network request failed'));

      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().name).toBe('John');
      expect(useProfileStore.getState().loadStatus).toBe('error');

      consoleError.mockRestore();
    });

    it('should recover to ready when a retry succeeds after a failure', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockMaybeSingle.mockRejectedValueOnce(new Error('Network request failed'));
      await useProfileStore.getState().loadProfile();
      expect(useProfileStore.getState().loadStatus).toBe('error');

      mockMaybeSingle.mockResolvedValueOnce({
        data: { name: 'John', daily_reminder_enabled: true },
        error: null,
      });
      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().loadStatus).toBe('ready');
      expect(useProfileStore.getState().name).toBe('John');

      consoleError.mockRestore();
    });

    it('should handle profile with null name (row exists but not set)', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { name: null, daily_reminder_enabled: true },
        error: null,
      });

      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().loadStatus).toBe('ready');
    });
  });

  describe('updateName', () => {
    it('should update name in Supabase', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const result = await useProfileStore.getState().updateName('Jane');

      expect(mockUpsert).toHaveBeenCalledWith(
        { user_id: mockUserId, name: 'Jane' },
        { onConflict: 'user_id' }
      );
      expect(result.error).toBeNull();
      expect(useProfileStore.getState().name).toBe('Jane');
      expect(useProfileStore.getState().isSaving).toBe(false);
    });

    it('should trim whitespace from name', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      await useProfileStore.getState().updateName('  Sarah  ');

      expect(mockUpsert).toHaveBeenCalledWith(
        { user_id: mockUserId, name: 'Sarah' },
        { onConflict: 'user_id' }
      );
      expect(useProfileStore.getState().name).toBe('Sarah');
    });

    it('should return error when not authenticated', async () => {
      signOut();

      const result = await useProfileStore.getState().updateName('Test');

      expect(mockUpsert).not.toHaveBeenCalled();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Not authenticated');
      expect(useProfileStore.getState().name).toBeNull();
    });

    it('should return error on upsert failure and keep old name', async () => {
      mockUpsert.mockResolvedValue({
        error: { code: 'PGRST500', message: 'Database error' },
      });

      const result = await useProfileStore.getState().updateName('Test');

      expect(result.error).toBeInstanceOf(Error);
      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isSaving).toBe(false);
    });

    it('should return error when the upsert request throws', async () => {
      mockUpsert.mockRejectedValue(new Error('Network request failed'));

      const result = await useProfileStore.getState().updateName('Test');

      expect(result.error).toBeInstanceOf(Error);
      expect(useProfileStore.getState().isSaving).toBe(false);
    });
  });

  describe('updateDailyReminder', () => {
    it('should update the reminder flag in Supabase', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const result = await useProfileStore.getState().updateDailyReminder(false);

      expect(mockUpsert).toHaveBeenCalledWith(
        { user_id: mockUserId, daily_reminder_enabled: false },
        { onConflict: 'user_id' }
      );
      expect(result.error).toBeNull();
      expect(useProfileStore.getState().dailyReminderEnabled).toBe(false);
    });

    it('should keep the old value on failure', async () => {
      mockUpsert.mockResolvedValue({
        error: { code: 'PGRST500', message: 'Database error' },
      });

      const result = await useProfileStore.getState().updateDailyReminder(false);

      expect(result.error).toBeInstanceOf(Error);
      expect(useProfileStore.getState().dailyReminderEnabled).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      useProfileStore.setState({
        name: 'Test User',
        loadStatus: 'ready',
        isSaving: true,
      });

      useProfileStore.getState().reset();

      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().loadStatus).toBe('idle');
      expect(useProfileStore.getState().isSaving).toBe(false);
    });
  });
});
