import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openEventStream } from './sse.js';

function createRequest() {
  const listeners: Record<string, () => void> = {};
  return {
    req: { on: vi.fn((event: string, listener: () => void) => (listeners[event] = listener)) },
    close: () => listeners.close(),
  };
}

function createResponse() {
  return {
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(() => true),
    end: vi.fn(),
    writableEnded: false,
  };
}

describe('openEventStream', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('aborts the turn on client disconnect when asked to', () => {
    const { req, close } = createRequest();
    const stream = openEventStream(req as never, createResponse() as never, { abortOnClose: true });

    close();

    expect(stream.signal.aborted).toBe(true);
  });

  it('lets the turn outlive the client when asked not to', () => {
    const { req, close } = createRequest();
    const stream = openEventStream(req as never, createResponse() as never, { abortOnClose: false });

    close();

    expect(stream.signal.aborted).toBe(false);
  });

  it('stops writing once the client is gone, heartbeat included', () => {
    const { req, close } = createRequest();
    const res = createResponse();
    const stream = openEventStream(req as never, res as never, { abortOnClose: false });

    stream.send({ type: 'text', delta: 'before' });
    close();
    stream.send({ type: 'text', delta: 'after' });
    vi.advanceTimersByTime(60_000);

    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.write).toHaveBeenCalledWith('data: {"type":"text","delta":"before"}\n\n');
  });

  it('sends a heartbeat while the client is connected', () => {
    const { req } = createRequest();
    const res = createResponse();
    openEventStream(req as never, res as never, { abortOnClose: false });

    vi.advanceTimersByTime(15_000);

    expect(res.write).toHaveBeenCalledWith(': ping\n\n');
  });
});
