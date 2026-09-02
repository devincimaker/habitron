import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/transcription.js';
import { authMiddleware } from '../middleware/auth.js';
import type { ErrorResponse } from '@habits-coach/shared';

const router: Router = Router();

// Configure multer for memory storage (max 10MB for 4 min audio).
// Shared with /api/instruct/enqueue, which takes the same recordings.
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/wav',
      'audio/x-wav',
      'audio/vnd.wave', // what iOS calls a .wav it uploads itself (interactive mode's utterances)
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mpeg',
      'audio/webm',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

// POST /api/transcribe - Transcribe audio to text
router.post(
  '/',
  authMiddleware,
  audioUpload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'No audio file provided',
        } satisfies ErrorResponse);
        return;
      }

      const transcription = await transcribeAudio(
        req.file.buffer,
        req.file.mimetype
      );

      res.json({ text: transcription });
    } catch (error) {
      console.error('Transcription error:', error);

      // Include more details in development
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: `Transcription failed: ${errorMessage}`,
      } satisfies ErrorResponse);
    }
  }
);

export default router;
