import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  scheduleFirstSkipNotification,
  setSupabaseClient,
  getNext9AM,
} from './notifications.js';

// Helper to create a chainable mock query builder
function createMockQueryBuilder(resolveValue: unknown) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chainMethods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'limit', 'head'];
  chainMethods.forEach((method) => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  builder.single = vi.fn().mockResolvedValue(resolveValue);

  // Make the builder thenable for non-single queries
  (builder as unknown as { then: (fn: (v: unknown) => void) => Promise<void> }).then = (resolve) => {
    Promise.resolve().then(() => resolve(resolveValue));
    return Promise.resolve();
  };

  return builder;
}

// Create a mock Supabase client
function createMockSupabase(tableResponses: Record<string, unknown>) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const response = tableResponses[table] ?? { data: null, error: null };
      return createMockQueryBuilder(response);
    }),
  };
}

describe('scheduleFirstSkipNotification', () => {
  const mockUserId = 'user-123';
  const mockHabitId = 'habit-456';

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not schedule if user already received first-skip notification', async () => {
    const mockSupabase = createMockSupabase({
      user_notification_flags: {
        data: { has_received_first_skip_notification: true },
        error: null,
      },
    });

    setSupabaseClient(mockSupabase as never);

    const result = await scheduleFirstSkipNotification(mockUserId, mockHabitId);

    expect(result.scheduled).toBe(false);
    expect(result.reason).toBe('already_received');
  });

  it('should not schedule if this is not the first skip (count > 1)', async () => {
    const mockSupabase = createMockSupabase({
      user_notification_flags: { data: null, error: null },
      habit_logs: { data: null, error: null, count: 5 },
    });

    setSupabaseClient(mockSupabase as never);

    const result = await scheduleFirstSkipNotification(mockUserId, mockHabitId);

    expect(result.scheduled).toBe(false);
    expect(result.reason).toBe('not_first_skip');
  });

  it('should not schedule if count is 0', async () => {
    const mockSupabase = createMockSupabase({
      user_notification_flags: { data: null, error: null },
      habit_logs: { data: null, error: null, count: 0 },
    });

    setSupabaseClient(mockSupabase as never);

    const result = await scheduleFirstSkipNotification(mockUserId, mockHabitId);

    expect(result.scheduled).toBe(false);
    expect(result.reason).toBe('not_first_skip');
  });

  it('should schedule notification for first-ever skip (count = 1)', async () => {
    const mockSupabase = createMockSupabase({
      user_notification_flags: { data: null, error: null },
      habit_logs: { data: null, error: null, count: 1 },
      push_tokens: { data: { timezone: 'America/New_York' }, error: null },
      habits: { data: { name: 'Exercise' }, error: null },
      scheduled_notifications: { data: null, error: null },
    });

    setSupabaseClient(mockSupabase as never);

    const result = await scheduleFirstSkipNotification(mockUserId, mockHabitId);

    expect(result.scheduled).toBe(true);
    expect(result.reason).toBeUndefined();

    // Verify correct tables were accessed
    expect(mockSupabase.from).toHaveBeenCalledWith('user_notification_flags');
    expect(mockSupabase.from).toHaveBeenCalledWith('habit_logs');
    expect(mockSupabase.from).toHaveBeenCalledWith('scheduled_notifications');
  });

  it('should return db_error when counting fails', async () => {
    // Mock console.error for this test only
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockSupabase = createMockSupabase({
      user_notification_flags: { data: null, error: null },
      habit_logs: { data: null, error: { message: 'DB error' }, count: null },
    });

    setSupabaseClient(mockSupabase as never);

    const result = await scheduleFirstSkipNotification(mockUserId, mockHabitId);

    expect(result.scheduled).toBe(false);
    expect(result.reason).toBe('db_error');
    // Verify the error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error counting skipped habits:', { message: 'DB error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('getNext9AM', () => {
  it('should return a date in the future', () => {
    const result = getNext9AM('America/New_York');
    expect(result.getTime()).toBeGreaterThan(Date.now());
  });

  it('should return tomorrow (not today)', () => {
    const result = getNext9AM('UTC');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // The result should be tomorrow, not today
    const resultDate = result.toISOString().split('T')[0];
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    expect(resultDate).toBe(tomorrowDate);
  });

  it('should handle different timezones', () => {
    const utcResult = getNext9AM('UTC');
    const nyResult = getNext9AM('America/New_York');

    // They should be different times in UTC
    // NY is 4-5 hours behind UTC, so 9 AM NY is 13-14 UTC
    expect(utcResult.getTime()).not.toBe(nyResult.getTime());
  });
});

describe('First-skip notification workflow integration', () => {
  it('should correctly identify first skip vs subsequent skips', async () => {
    // First skip scenario
    const firstSkipMock = createMockSupabase({
      user_notification_flags: { data: null, error: null },
      habit_logs: { data: null, error: null, count: 1 },
      push_tokens: { data: { timezone: 'UTC' }, error: null },
      habits: { data: { name: 'Test Habit' }, error: null },
      scheduled_notifications: { data: null, error: null },
    });

    setSupabaseClient(firstSkipMock as never);
    const firstResult = await scheduleFirstSkipNotification('user-1', 'habit-1');
    expect(firstResult.scheduled).toBe(true);

    // Already received scenario
    const alreadyReceivedMock = createMockSupabase({
      user_notification_flags: {
        data: { has_received_first_skip_notification: true },
        error: null,
      },
    });

    setSupabaseClient(alreadyReceivedMock as never);
    const secondResult = await scheduleFirstSkipNotification('user-1', 'habit-2');
    expect(secondResult.scheduled).toBe(false);
    expect(secondResult.reason).toBe('already_received');
  });
});
