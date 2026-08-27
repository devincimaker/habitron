import { Router, Request, Response } from 'express';
import type { CoachStreamEvent, CoachTurnRecord, CoachTurnRequest, ErrorResponse } from '@habits-coach/shared';
import { runCoachTurn } from '../coach/agent.js';
import { COACH_TURN_FAILED_MESSAGE } from '../coach/events.js';
import { openEventStream } from '../coach/sse.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { findCoachSession, recordTurn } from '../services/coachSessions.js';

const router: Router = Router();

/** What a 500 tells the app when the turn never got as far as the stream. */
const CHAT_UNAVAILABLE_MESSAGE = 'Failed to process message. Please try again.';

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
    res.status(500).json({ error: CHAT_UNAVAILABLE_MESSAGE } satisfies ErrorResponse);
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
    res.status(500).json({ error: CHAT_UNAVAILABLE_MESSAGE } satisfies ErrorResponse);
    return;
  }

  // No `abortOnDisconnect`: the turn outlives its socket, and its record is
  // how the app gets the reply back.
  const stream = openEventStream(req, res);

  // The `session` event carries the Agent SDK session id as soon as the turn
  // has one, so even a turn that throws — the wall-clock cap firing on work
  // the coach already did — stays resumable.
  let claudeSessionId = session.claudeSessionId;
  const send = (event: CoachStreamEvent) => {
    if (event.type === 'session') claudeSessionId = event.claudeSessionId;
    stream.send(event);
  };

  let turn: CoachTurnRecord;
  try {
    const result = await runCoachTurn(
      {
        userId,
        prompt: trimmedPrompt,
        timezone,
        userName: isNonEmptyString(userName) ? userName : undefined,
        claudeSessionId: session.claudeSessionId,
      },
      send
    );

    claudeSessionId = result.claudeSessionId ?? claudeSessionId;
    // The record says what the stream said: an SDK error result reaches the
    // client as `error`, so it is a failed turn here too, never a silent reply.
    turn =
      result.outcome.type === 'done'
        ? { prompt: trimmedPrompt, status: 'done', reply: result.outcome.message }
        : { prompt: trimmedPrompt, status: 'failed', error: result.outcome.message };
  } catch (error) {
    console.error('Chat error:', error);
    send({ type: 'error', message: COACH_TURN_FAILED_MESSAGE });
    turn = { prompt: trimmedPrompt, status: 'failed', error: COACH_TURN_FAILED_MESSAGE };
  }

  // Outside the turn's own catch: a write that fails here must not turn a
  // finished turn into a failed one, nor send an error after `done`.
  try {
    await recordTurn(sessionId, userId, turn, claudeSessionId);
  } catch (error) {
    console.error('Failed to record how the turn ended:', error);
  } finally {
    stream.close();
  }
}

router.post('/', authMiddleware, chatRateLimiter, handleChatRequest);

export default router;
