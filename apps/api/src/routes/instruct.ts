import { Router, Request, Response } from 'express';
import type { CoachInstructRequest, ErrorResponse } from '@habits-coach/shared';
import { INSTRUCT_SKILLS, runCoachTurn } from '../coach/agent.js';
import { COACH_TURN_FAILED_MESSAGE } from '../coach/events.js';
import { openEventStream } from '../coach/sse.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';

const router: Router = Router();

/** What the app sends when the user taps Apply; the `instruct` skill keys on it. */
export const APPLY_PROMPT = 'Apply the proposal.';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface InstructTurn {
  prompt: string;
  claudeSessionId: string | null;
  readOnly: boolean;
}

/**
 * Maps the request to one turn of the `instruct` skill. A proposal (and a
 * correction of it) sees only the read tools, so nothing changes until the
 * user has applied what they saw; `apply` resumes the same session with the
 * full tool set.
 */
function resolveInstructTurn(body: Partial<CoachInstructRequest>): InstructTurn | string {
  const text = isNonEmptyString(body.text) ? body.text.trim() : null;
  const claudeSessionId = isNonEmptyString(body.claudeSessionId) ? body.claudeSessionId : null;

  switch (body.kind) {
    case 'propose':
      if (!text) return 'Invalid request: text is required to propose';
      return { prompt: `/instruct ${text}`, claudeSessionId: null, readOnly: true };
    case 'correct':
      if (!text) return 'Invalid request: text is required to correct';
      if (!claudeSessionId) return 'Invalid request: claudeSessionId is required to correct';
      return { prompt: `Correction: ${text}`, claudeSessionId, readOnly: true };
    case 'apply':
      if (!claudeSessionId) return 'Invalid request: claudeSessionId is required to apply';
      return { prompt: APPLY_PROMPT, claudeSessionId, readOnly: false };
    default:
      return 'Invalid request: kind must be propose, correct, or apply';
  }
}

/**
 * POST /api/instruct — one hold-to-instruct turn, streamed exactly like
 * /api/chat but without a coaching session: nothing is stored server-side,
 * and the `session` event carries the id the app resumes for the next turn.
 */
export async function handleInstructRequest(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Partial<CoachInstructRequest>;
  const userId = req.user!.id;

  if (!isNonEmptyString(body.timezone)) {
    res.status(400).json({ error: 'Invalid request: timezone is required' } satisfies ErrorResponse);
    return;
  }

  const turn = resolveInstructTurn(body);
  if (typeof turn === 'string') {
    res.status(400).json({ error: turn } satisfies ErrorResponse);
    return;
  }

  // A hold-to-instruct turn dies with its socket: HAB-110's slide-up cancel is
  // the client hanging up, and nothing here is recorded to come back to.
  const stream = openEventStream(req, res, { abortOnDisconnect: true });

  try {
    await runCoachTurn(
      {
        userId,
        prompt: turn.prompt,
        timezone: body.timezone,
        userName: isNonEmptyString(body.userName) ? body.userName : undefined,
        claudeSessionId: turn.claudeSessionId,
        skills: INSTRUCT_SKILLS,
        readOnly: turn.readOnly,
        signal: stream.signal,
      },
      stream.send
    );
  } catch (error) {
    // An aborted turn is the user cancelling, not a failure to report.
    if (!stream.signal?.aborted) {
      console.error('Instruct error:', error);
      stream.send({ type: 'error', message: COACH_TURN_FAILED_MESSAGE });
    }
  } finally {
    stream.close();
  }
}

router.post('/', authMiddleware, chatRateLimiter, handleInstructRequest);

export default router;
