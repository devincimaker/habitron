import type { Request, Response } from 'express';
import type { CoachStreamEvent } from '@habits-coach/shared';

const HEARTBEAT_MS = 15_000;

export interface EventStream {
  /** A no-op once the client has gone away: a turn may outlive its socket. */
  send: (event: CoachStreamEvent) => void;
  /** Aborts when the client goes away, for a turn that should stop with it. */
  signal: AbortSignal;
  close: () => void;
}

/**
 * Opens a server-sent event stream: one `CoachStreamEvent` JSON per `data:`
 * line, with a comment heartbeat so proxies keep the connection alive.
 */
export function openEventStream(req: Request, res: Response): EventStream {
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
    abort.abort();
  });

  function write(chunk: string) {
    if (!clientGone) res.write(chunk);
  }

  return {
    send: (event) => write(`data: ${JSON.stringify(event)}\n\n`),
    signal: abort.signal,
    close: () => {
      clearInterval(heartbeat);
      res.end();
    },
  };
}
