/**
 * Profile Store Tests
 *
 * These tests verify the user profile store behavior:
 * - Loading profile data from Supabase
 * - Updating the user's name
 * - Proper state management and error handling
 */

// Mock Supabase before importing the store
const mockGetUser = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: (columns: string) => {
        mockSelect(columns);
        return {
          eq: (column: string, value: string) => {
            mockEq(column, value);
            return {
              single: () => mockSingle(),
            };
          },
        };
      },
      upsert: (data: unknown, options: unknown) => mockUpsert(data, options),
    }),
  },
}));

import { useProfileStore } from '../stores/useProfileStore';

describe('useProfileStore', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    // Reset store state before each test
    useProfileStore.setState({
      name: null,
      isLoading: false,
      isInitialized: false,
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('loadProfile', () => {
    /**
     * Test: Successfully loads profile with name
     */
    it('should load profile name from Supabase', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockSingle.mockResolvedValue({
        data: { name: 'John' },
        error: null,
      });

      await useProfileStore.getState().loadProfile();

      expect(mockGetUser).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalledWith('name');
      expect(mockEq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(useProfileStore.getState().name).toBe('John');
      expect(useProfileStore.getState().isInitialized).toBe(true);
      expect(useProfileStore.getState().isLoading).toBe(false);
    });

    /**
     * Test: New user with no profile record
     *
     * PGRST116 error means "no rows returned" which is expected
     * for new users who haven't set their name yet.
     */
    it('should handle new user with no profile (PGRST116)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isInitialized).toBe(true);
      expect(useProfileStore.getState().isLoading).toBe(false);
    });

    /**
     * Test: No authenticated user
     */
    it('should handle no authenticated user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      await useProfileStore.getState().loadProfile();

      expect(mockSingle).not.toHaveBeenCalled();
      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isInitialized).toBe(true);
      expect(useProfileStore.getState().isLoading).toBe(false);
    });

    /**
     * Test: Database error (non-PGRST116)
     *
     * Other errors should be logged but not crash the app.
     */
    it('should handle database errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' },
      });

      await useProfileStore.getState().loadProfile();

      expect(consoleError).toHaveBeenCalledWith(
        'Error loading profile:',
        expect.objectContaining({ code: 'PGRST500' })
      );
      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isInitialized).toBe(true);

      consoleError.mockRestore();
    });

    /**
     * Test: Profile with null name (exists but not set)
     */
    it('should handle profile with null name', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockSingle.mockResolvedValue({
        data: { name: null },
        error: null,
      });

      await useProfileStore.getState().loadProfile();

      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isInitialized).toBe(true);
    });
  });

  describe('updateName', () => {
    /**
     * Test: Successfully updates name
     */
    it('should update name in Supabase', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      const result = await useProfileStore.getState().updateName('Jane');

      expect(mockUpsert).toHaveBeenCalledWith(
        { user_id: mockUserId, name: 'Jane' },
        { onConflict: 'user_id' }
      );
      expect(result.error).toBeNull();
      expect(useProfileStore.getState().name).toBe('Jane');
      expect(useProfileStore.getState().isLoading).toBe(false);
    });

    /**
     * Test: Trims whitespace from name
     */
    it('should trim whitespace from name', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      await useProfileStore.getState().updateName('  Sarah  ');

      expect(mockUpsert).toHaveBeenCalledWith(
        { user_id: mockUserId, name: 'Sarah' },
        { onConflict: 'user_id' }
      );
      expect(useProfileStore.getState().name).toBe('Sarah');
    });

    /**
     * Test: No authenticated user
     */
    it('should return error when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const result = await useProfileStore.getState().updateName('Test');

      expect(mockUpsert).not.toHaveBeenCalled();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Not authenticated');
      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isLoading).toBe(false);
    });

    /**
     * Test: Upsert error from Supabase
     */
    it('should return error on upsert failure', async () => {
      const dbError = { code: 'PGRST500', message: 'Database error' };
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
      mockUpsert.mockResolvedValue({ error: dbError });

      const result = await useProfileStore.getState().updateName('Test');

      expect(result.error).toEqual(dbError);
      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    /**
     * Test: Resets all state to initial values
     */
    it('should reset all state', () => {
      // Set some state first
      useProfileStore.setState({
        name: 'Test User',
        isLoading: true,
        isInitialized: true,
      });

      useProfileStore.getState().reset();

      expect(useProfileStore.getState().name).toBeNull();
      expect(useProfileStore.getState().isLoading).toBe(false);
      expect(useProfileStore.getState().isInitialized).toBe(false);
    });
  });
});
