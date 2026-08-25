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
