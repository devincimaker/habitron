import { vi } from 'vitest';

/**
 * Creates a mock Supabase client for testing.
 * Use this to control database responses in tests.
 */
export function createMockSupabase() {
  const mockData: Record<string, unknown> = {};
  const mockError: Record<string, unknown> = {};
  const mockCount: Record<string, number> = {};

  const createQueryBuilder = () => {
    let tableName = '';

    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          data: mockData[tableName] ?? null,
          error: mockError[tableName] ?? null,
        });
      }),
      then: (resolve: (value: unknown) => void) => {
        resolve({
          data: mockData[tableName] ?? null,
          error: mockError[tableName] ?? null,
          count: mockCount[tableName] ?? null,
        });
      },
    };

    return builder;
  };

  const mockSupabase = {
    from: vi.fn().mockImplementation((table: string) => {
      const builder = createQueryBuilder();
      // Store table name for later use
      (builder as unknown as { _table: string })._table = table;
      return builder;
    }),
    auth: {
      getUser: vi.fn(),
    },
    // Helper methods for tests to set up mock data
    __setMockData: (table: string, data: unknown) => {
      mockData[table] = data;
    },
    __setMockError: (table: string, error: unknown) => {
      mockError[table] = error;
    },
    __setMockCount: (table: string, count: number) => {
      mockCount[table] = count;
    },
    __reset: () => {
      Object.keys(mockData).forEach((key) => delete mockData[key]);
      Object.keys(mockError).forEach((key) => delete mockError[key]);
      Object.keys(mockCount).forEach((key) => delete mockCount[key]);
    },
  };

  return mockSupabase;
}

/**
 * Creates a mock Express request object.
 */
export function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user-id', email: 'test@example.com' },
    ...overrides,
  };
}

/**
 * Creates a mock Express response object.
 */
export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
}
