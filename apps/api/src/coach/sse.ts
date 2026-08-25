import type { Request, Response } from 'express';
import type { CoachStreamEvent } from '@habits-coach/shared';

const HEARTBEAT_MS = 15_000;

export interface EventStream {
  send: (event: CoachStreamEvent) => void;
  /** Aborts when the client goes away, so the turn stops burning tokens. */
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

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  const abort = new AbortController();
  req.on('close', () => abort.abort());

  return {
    send: (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    signal: abort.signal,
    close: () => {
      clearInterval(heartbeat);
      res.end();
    },
  };
}
