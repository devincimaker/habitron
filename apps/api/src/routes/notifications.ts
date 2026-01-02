import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { scheduleFirstSkipNotification } from '../services/notifications.js';

const router = Router();

/**
 * POST /api/notifications/first-skip
 *
 * Called when a user skips a habit. Checks if this is their first-ever skip
 * and schedules a notification for the next morning if so.
 */
router.post(
  '/first-skip',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { habitId } = req.body;

      if (!habitId || typeof habitId !== 'string') {
        res.status(400).json({ error: 'habitId is required' });
        return;
      }

      const result = await scheduleFirstSkipNotification(userId, habitId);

      res.json({
        success: true,
        scheduled: result.scheduled,
        reason: result.reason,
      });
    } catch (error) {
      console.error('Error handling first skip:', error);
      res.status(500).json({ error: 'Failed to process skip notification' });
    }
  }
);

export default router;
