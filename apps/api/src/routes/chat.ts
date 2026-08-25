import { Router, Request, Response } from 'express';
import type { CoachTurnRequest, ErrorResponse } from '@habits-coach/shared';
import { runCoachTurn } from '../coach/agent.js';
import { openEventStream } from '../coach/sse.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { findCoachSession, setClaudeSessionId } from '../services/coachSessions.js';

const router: Router = Router();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * POST /api/chat — one coaching turn, streamed as server-sent events
 * (`CoachStreamEvent` JSON per `data:` line). The turn ends with `done` or `error`.
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

  const stream = openEventStream(req, res);

  try {
    const result = await runCoachTurn(
      {
        userId,
        prompt: prompt.trim(),
        timezone,
        userName: isNonEmptyString(userName) ? userName : undefined,
        claudeSessionId: session.claudeSessionId,
        signal: stream.signal,
      },
      stream.send
    );

    if (result.claudeSessionId && result.claudeSessionId !== session.claudeSessionId) {
      await setClaudeSessionId(sessionId, userId, result.claudeSessionId);
    }
  } catch (error) {
    if (!stream.signal.aborted) {
      console.error('Chat error:', error);
      stream.send({ type: 'error', message: 'The coach ran into a problem. Please try again.' });
    }
  } finally {
    stream.close();
  }
}

router.post('/', authMiddleware, chatRateLimiter, handleChatRequest);

export default router;
