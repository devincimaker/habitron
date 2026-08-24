import type { CoachStreamEvent } from '@habits-coach/shared';

import { createSseParser } from '../utils/sse';

describe('createSseParser', () => {
  it('emits one event per data block, across chunk boundaries, ignoring comments', () => {
    const events: CoachStreamEvent[] = [];
    const feed = createSseParser((event) => events.push(event));

    feed('data: {"type":"session","claudeSessionId":"abc"}\n\n: ping\n\ndata: {"type":"text",');
    feed('"delta":"Hel"}\n\ndata: {"type":"text","delta":"lo"}\n\n');
    feed('data: {"type":"done","message":"Hello"}\n\n');

    expect(events).toEqual([
      { type: 'session', claudeSessionId: 'abc' },
      { type: 'text', delta: 'Hel' },
      { type: 'text', delta: 'lo' },
      { type: 'done', message: 'Hello' },
    ]);
  });
});
