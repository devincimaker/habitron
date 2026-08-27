import { vi } from 'vitest';
import type { CoachStreamEvent } from '@habits-coach/shared';

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

/** A request whose `close` listeners can be fired, as when the client goes away mid-stream. */
export function createStreamingRequest(overrides: Record<string, unknown> = {}) {
  const listeners: Record<string, () => void> = {};
  return {
    ...createMockRequest({
      user: { id: 'user-123', email: 'test@example.com' },
      ...overrides,
    }),
    on: vi.fn((event: string, listener: () => void) => (listeners[event] = listener)),
    disconnect: () => listeners.close(),
  };
}

/** A response that records what was streamed; `events()` parses the `data:` lines back. */
export function createStreamingResponse() {
  const chunks: string[] = [];
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn(),
  };
  const events = () =>
    chunks
      .filter((chunk) => chunk.startsWith('data: '))
      .map((chunk) => JSON.parse(chunk.slice('data: '.length)) as CoachStreamEvent);
  return { res, events };
}
