import { Router, Request, Response } from 'express';
import type { ErrorResponse } from '@habits-coach/shared';
import { toApiRow, createSupabaseInstructActionsDb } from '../services/instructActions.js';
import { instructQueue } from '../services/instructQueue.js';
import { transcribeAudio } from '../services/transcription.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { audioUpload } from './transcribe.js';

const router: Router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * POST /api/instruct/enqueue — fire-and-forget: transcribe (or take `text`),
 * insert a queued row, kick the worker, return the row. The client's only
 * obligation is finishing this upload; everything after is server state.
 */
export async function handleEnqueueRequest(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(body.timezone)) {
      res.status(400).json({ error: 'Invalid request: timezone is required' } satisfies ErrorResponse);
      return;
    }
    const reinstructOf = isNonEmptyString(body.reinstructOf) ? body.reinstructOf.trim() : undefined;
    if (reinstructOf && !UUID.test(reinstructOf)) {
      res.status(400).json({ error: 'Invalid request: reinstructOf is not an action id' } satisfies ErrorResponse);
      return;
    }
    // The client names the row so it can look this instruction up when the
    // reply is lost with the connection; a repeat of the same id is that row.
    const id = isNonEmptyString(body.id) ? body.id.trim() : undefined;
    if (id && !UUID.test(id)) {
      res.status(400).json({ error: 'Invalid request: id is not an action id' } satisfies ErrorResponse);
      return;
    }

    let transcript = isNonEmptyString(body.text) ? body.text.trim() : '';
    if (!transcript && req.file) {
      transcript = (await transcribeAudio(req.file.buffer, req.file.mimetype)).trim();
    }
    if (!transcript) {
      // Nothing intelligible to enqueue; the client shows its "didn't catch that" notice.
      res.status(422).json({ error: 'Nothing heard', code: 'nothing_heard' } satisfies ErrorResponse);
      return;
    }

    const row = await instructQueue().enqueue({
      id,
      userId: req.user!.id,
      transcript,
      timezone: body.timezone.trim(),
      reinstructOf,
    });
    res.json({ action: toApiRow(row) });
  } catch (error) {
    console.error('Instruct enqueue error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to enqueue: ${message}` } satisfies ErrorResponse);
  }
}

router.post('/enqueue', authMiddleware, chatRateLimiter, audioUpload.single('audio'), handleEnqueueRequest);

/** GET /api/instruct/log?since= — the rows the pill, sheet, and hub count derive from. */
router.get('/log', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const since = isNonEmptyString(req.query.since) ? req.query.since : undefined;
    const rows = await createSupabaseInstructActionsDb().list(req.user!.id, since);
    res.json({ actions: rows.map(toApiRow) });
  } catch (error) {
    console.error('Instruct log error:', error);
    res.status(500).json({ error: 'Failed to read the activity log' } satisfies ErrorResponse);
  }
});

type QueueVerb = 'retry' | 'cancel' | 'dismiss' | 'rewind' | 'restore';

async function applyVerb(verb: QueueVerb, userId: string, id: string) {
  const queue = instructQueue();
  switch (verb) {
    case 'retry':
      return queue.retry(userId, id);
    case 'cancel':
      return queue.cancel(userId, id);
    case 'dismiss':
      return queue.dismiss(userId, id);
    case 'rewind':
      return queue.rewind(userId, id, 'undo');
    case 'restore':
      return queue.rewind(userId, id, 'redo');
  }
}

for (const verb of ['retry', 'cancel', 'dismiss', 'rewind', 'restore'] as const) {
  router.post(`/:id/${verb}`, authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!UUID.test(id)) {
      res.status(404).json({ error: 'No such action' } satisfies ErrorResponse);
      return;
    }
    try {
      const row = await applyVerb(verb, req.user!.id, id);
      if (!row) {
        res.status(404).json({ error: 'No such action' } satisfies ErrorResponse);
        return;
      }
      res.json({ action: toApiRow(row) });
    } catch (error) {
      console.error(`Instruct ${verb} error:`, error);
      res.status(500).json({ error: `Failed to ${verb}` } satisfies ErrorResponse);
    }
  });
}

export default router;
