import type { CoachStreamEvent } from '@habits-coach/shared';

/**
 * The stream opened and then dropped before the turn ended — iOS tears the
 * socket down when the app is suspended. The server may still be running the
 * turn; what to do about that is the caller's call.
 */
export class CoachStreamDroppedError extends Error {
  constructor(cause: unknown) {
    super('The coach stream dropped before the turn ended', { cause });
    this.name = 'CoachStreamDroppedError';
  }
}

/** Parses server-sent events (`data: <json>` blocks) out of a text stream, incrementally. */
export function createSseParser(onEvent: (event: CoachStreamEvent) => void): (chunk: string) => void {
  let buffer = '';

  return (chunk: string) => {
    buffer += chunk;
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          onEvent(JSON.parse(line.slice('data: '.length)) as CoachStreamEvent);
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  };
}
