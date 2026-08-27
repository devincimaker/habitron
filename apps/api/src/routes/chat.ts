import { Router, Request, Response } from 'express';
import type { CoachTurnRequest, ErrorResponse } from '@habits-coach/shared';
import { runCoachTurn } from '../coach/agent.js';
import { openEventStream } from '../coach/sse.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { findCoachSession, recordTurn, setClaudeSessionId } from '../services/coachSessions.js';

const router: Router = Router();

/**
 * How long a turn may run once its client is gone. The turn outlives the
 * socket on purpose (the app reads the reply back on foreground), so this is
 * the only thing that stops an abandoned session from running forever.
 */
const TURN_CAP_MS = 5 * 60_000;
const TURN_FAILED_MESSAGE = 'The coach ran into a problem. Please try again.';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * POST /api/chat — one coaching turn, streamed as server-sent events
 * (`CoachStreamEvent` JSON per `data:` line). The turn ends with `done` or `error`.
 *
 * The turn is recorded on the session before the stream opens and again when
 * it ends, and it keeps running if the client disconnects: a 200 means the
 * record belongs to this turn, and the app polls it if its stream drops.
 */
export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  const { sessionId, prompt, timezone, userName } = (req.body ?? {}) as Partial<CoachTurnRequest>;
  const userId = req.user!.id;

  if (!isNonEmptyString(sessionId)) {
    res.status(400).json({
      error: 'A valid coaching session is required.',
      code: 'session_required',
    } satisfies ErrorResponse);
    return;
  }

  if (!isNonEmptyString(prompt)) {
    res.status(400).json({ error: 'Invalid request: prompt is required' } satisfies ErrorResponse);
    return;
  }

  if (!isNonEmptyString(timezone)) {
    res.status(400).json({ error: 'Invalid request: timezone is required' } satisfies ErrorResponse);
    return;
  }

  const trimmedPrompt = prompt.trim();

  let session;
  try {
    session = await findCoachSession(sessionId, userId);
    if (session) {
      await recordTurn(sessionId, userId, { prompt: trimmedPrompt, status: 'running' });
    }
  } catch (error) {
    console.error('Failed to load coaching session:', error);
    res.status(500).json({ error: 'Failed to process message. Please try again.' } satisfies ErrorResponse);
    return;
  }

  if (!session) {
    console.warn('Rejecting unauthorized chat sessionId:', sessionId);
    res.status(403).json({
      error: 'You do not have access to that coaching session.',
      code: 'session_forbidden',
    } satisfies ErrorResponse);
    return;
  }

  const stream = openEventStream(req, res, { abortOnClose: false });

  try {
    const result = await runCoachTurn(
      {
        userId,
        prompt: trimmedPrompt,
        timezone,
        userName: isNonEmptyString(userName) ? userName : undefined,
        claudeSessionId: session.claudeSessionId,
        signal: AbortSignal.timeout(TURN_CAP_MS),
      },
      stream.send
    );

    if (result.claudeSessionId && result.claudeSessionId !== session.claudeSessionId) {
      await setClaudeSessionId(sessionId, userId, result.claudeSessionId);
    }
    await recordTurn(sessionId, userId, { prompt: trimmedPrompt, status: 'done', reply: result.text });
  } catch (error) {
    console.error('Chat error:', error);
    stream.send({ type: 'error', message: TURN_FAILED_MESSAGE });
    await recordTurn(sessionId, userId, { prompt: trimmedPrompt, status: 'failed', error: TURN_FAILED_MESSAGE }).catch(
      (recordError) => console.error('Failed to record the failed turn:', recordError)
    );
  } finally {
    stream.close();
  }
}

router.post('/', authMiddleware, chatRateLimiter, handleChatRequest);

export default router;
