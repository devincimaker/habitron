import { Router, Request, Response } from 'express';
import { sendMessage } from '../services/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import type { ChatRequest, ErrorResponse } from '@habits-coach/shared';

const router = Router();

// POST /api/chat - Send message to AI coach
router.post(
  '/',
  authMiddleware,
  chatRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { messages, habits, memories } = req.body as ChatRequest;

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

      // Send to OpenAI
      const response = await sendMessage({ messages, habits, memories });

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
);

export default router;
