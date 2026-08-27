import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreamingRequest, createStreamingResponse } from '../test/mocks.js';
import { openEventStream } from './sse.js';

describe('openEventStream', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('aborts its signal when the client disconnects, for a stream that asked for one', () => {
    const req = createStreamingRequest();
    const stream = openEventStream(req as never, createStreamingResponse().res as never, {
      abortOnDisconnect: true,
    });

    req.disconnect();

    expect(stream.signal?.aborted).toBe(true);
  });

  it('hands back no signal by default, so a turn cannot be stopped by a disconnect', () => {
    const stream = openEventStream(createStreamingRequest() as never, createStreamingResponse().res as never);

    expect(stream.signal).toBeUndefined();
  });

  it('stops writing once the client is gone, heartbeat included', () => {
    const req = createStreamingRequest();
    const { res, events } = createStreamingResponse();
    const stream = openEventStream(req as never, res as never);

    stream.send({ type: 'text', delta: 'before' });
    req.disconnect();
    stream.send({ type: 'text', delta: 'after' });
    vi.advanceTimersByTime(60_000);

    expect(res.write).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([{ type: 'text', delta: 'before' }]);
  });

  it('sends a heartbeat while the client is connected', () => {
    const { res } = createStreamingResponse();
    openEventStream(createStreamingRequest() as never, res as never);

    vi.advanceTimersByTime(15_000);

    expect(res.write).toHaveBeenCalledWith(': ping\n\n');
  });
});
