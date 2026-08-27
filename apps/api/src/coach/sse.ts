import type { Request, Response } from 'express';
import type { CoachStreamEvent } from '@habits-coach/shared';

const HEARTBEAT_MS = 15_000;

export interface EventStream {
  /** A no-op once the client has gone away: a turn may outlive its socket. */
  send: (event: CoachStreamEvent) => void;
  /** The signal to stop the turn with, and only there: opened with `abortOnDisconnect`. */
  signal?: AbortSignal;
  close: () => void;
}

export interface EventStreamOptions {
  /**
   * Hand back a signal that aborts when the client goes away, for a turn that
   * should die with its socket. Without it there is no signal to pass on, so a
   * turn cannot be stopped by a disconnect even by accident.
   */
  abortOnDisconnect?: boolean;
}

/**
 * Opens a server-sent event stream: one `CoachStreamEvent` JSON per `data:`
 * line, with a comment heartbeat so proxies keep the connection alive.
 */
export function openEventStream(req: Request, res: Response, options: EventStreamOptions = {}): EventStream {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
  const abort = new AbortController();
  req.on('close', () => {
    clearInterval(heartbeat);
    abort.abort();
  });

  function write(chunk: string) {
    if (!abort.signal.aborted) res.write(chunk);
  }

  return {
    send: (event) => write(`data: ${JSON.stringify(event)}\n\n`),
    signal: options.abortOnDisconnect ? abort.signal : undefined,
    close: () => {
      clearInterval(heartbeat);
      res.end();
    },
  };
}
