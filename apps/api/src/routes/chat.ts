import { Router, Request, Response } from 'express';
import { sendMessage } from '../services/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { sessionBelongsToUser } from '../services/coachDebugEvents.js';
import type { ChatRequest, ErrorResponse } from '@habits-coach/shared';

const router: Router = Router();

export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  try {
    const {
      sessionId,
      messages,
      habits,
      goals,
      todos,
      journalEntries,
      dailyPlan,
      memories,
      userName,
      today,
      timezone,
    } = req.body as ChatRequest & { diaryEntries?: ChatRequest['journalEntries'] };

    // Validate request body
    if (!Array.isArray(messages)) {
      res.status(400).json({
        error: 'Invalid request: messages must be an array',
      } satisfies ErrorResponse);
      return;
    }

    if (!Array.isArray(habits)) {
      res.status(400).json({
        error: 'Invalid request: habits must be an array',
      } satisfies ErrorResponse);
      return;
    }

    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      res.status(400).json({
        error: 'A valid coaching session is required.',
        code: 'session_required',
      } satisfies ErrorResponse);
      return;
    }

    const belongsToUser = await sessionBelongsToUser(sessionId, req.user!.id);
    if (!belongsToUser) {
      console.warn('Rejecting unauthorized chat sessionId:', sessionId);
      res.status(403).json({
        error: 'You do not have access to that coaching session.',
        code: 'session_forbidden',
      } satisfies ErrorResponse);
      return;
    }

    const response = await sendMessage({
      sessionId,
      messages,
      habits,
      goals,
      todos,
      journalEntries: journalEntries ?? req.body.diaryEntries,
      dailyPlan,
      memories,
      userName,
      today,
      timezone,
    }, {
      userId: req.user!.id,
    });

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);

    if (error instanceof SyntaxError) {
      res.status(500).json({
        error: 'Failed to parse AI response',
      } satisfies ErrorResponse);
      return;
    }

    res.status(500).json({
      error: 'Failed to process message. Please try again.',
    } satisfies ErrorResponse);
  }
}

// POST /api/chat - Send message to AI coach
router.post('/', authMiddleware, chatRateLimiter, handleChatRequest);

export default router;
