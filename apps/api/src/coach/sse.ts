import type { Request, Response } from 'express';
import type { CoachStreamEvent } from '@habits-coach/shared';

const HEARTBEAT_MS = 15_000;

export interface EventStream {
  /** A no-op once the client has gone away: the turn may outlive its socket. */
  send: (event: CoachStreamEvent) => void;
  /** Aborts when the client goes away, if the stream was opened with `abortOnClose`. */
  signal: AbortSignal;
  close: () => void;
}

export interface EventStreamOptions {
  /**
   * Abort the turn when the client disconnects. A hold-to-instruct turn does —
   * that is how slide-up cancel cancels. A coaching turn does not: iOS drops the
   * socket whenever the app is suspended, and the turn is recorded server-side
   * for the app to pick up on foreground.
   */
  abortOnClose: boolean;
}

/**
 * Opens a server-sent event stream: one `CoachStreamEvent` JSON per `data:`
 * line, with a comment heartbeat so proxies keep the connection alive.
 */
export function openEventStream(req: Request, res: Response, { abortOnClose }: EventStreamOptions): EventStream {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
  const abort = new AbortController();
  let clientGone = false;
  req.on('close', () => {
    clientGone = true;
    clearInterval(heartbeat);
    if (abortOnClose) abort.abort();
  });

  function write(chunk: string) {
    if (clientGone || res.writableEnded) return;
    res.write(chunk);
  }

  return {
    send: (event) => write(`data: ${JSON.stringify(event)}\n\n`),
    signal: abort.signal,
    close: () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    },
  };
}
