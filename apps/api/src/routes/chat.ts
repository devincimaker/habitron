import { Router, Request, Response } from 'express';
import type { CoachTurnRequest, ErrorResponse } from '@habits-coach/shared';
import { runCoachTurn } from '../coach/agent.js';
import { COACH_TURN_FAILED_MESSAGE } from '../coach/events.js';
import { openEventStream } from '../coach/sse.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { findCoachSession, recordTurn } from '../services/coachSessions.js';

const router: Router = Router();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * POST /api/chat — one coaching turn, streamed as server-sent events
 * (`CoachStreamEvent` JSON per `data:` line). The turn ends with `done` or `error`.
 *
 * The turn is recorded on the session before the stream opens and again when
 * it ends, and it keeps running if the client disconnects: a 200 means the
 * record is this turn's, and the app polls it if its stream drops.
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

  let session;
  try {
    session = await findCoachSession(sessionId, userId);
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

  const trimmedPrompt = prompt.trim();
  try {
    await recordTurn(sessionId, userId, { prompt: trimmedPrompt, status: 'running' });
  } catch (error) {
    console.error('Failed to record the turn:', error);
    res.status(500).json({ error: 'Failed to process message. Please try again.' } satisfies ErrorResponse);
    return;
  }

  const stream = openEventStream(req, res);

  try {
    const result = await runCoachTurn(
      {
        userId,
        prompt: trimmedPrompt,
        timezone,
        userName: isNonEmptyString(userName) ? userName : undefined,
        claudeSessionId: session.claudeSessionId,
      },
      stream.send
    );

    const newClaudeSessionId =
      result.claudeSessionId && result.claudeSessionId !== session.claudeSessionId
        ? result.claudeSessionId
        : undefined;
    await recordTurn(
      sessionId,
      userId,
      { prompt: trimmedPrompt, status: 'done', reply: result.text },
      newClaudeSessionId
    );
  } catch (error) {
    console.error('Chat error:', error);
    stream.send({ type: 'error', message: COACH_TURN_FAILED_MESSAGE });
    await recordTurn(sessionId, userId, {
      prompt: trimmedPrompt,
      status: 'failed',
      error: COACH_TURN_FAILED_MESSAGE,
    }).catch((recordError) => console.error('Failed to record the failed turn:', recordError));
  } finally {
    stream.close();
  }
}

router.post('/', authMiddleware, chatRateLimiter, handleChatRequest);

export default router;
