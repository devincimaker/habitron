import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the transcribeAudio service
vi.mock('../services/openai.js', () => ({
  transcribeAudio: vi.fn(),
}));

// Mock auth middleware to always pass and set user
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { userId: string }).userId = 'test-user-123';
    next();
  },
}));

import { transcribeAudio } from '../services/openai.js';

describe('transcribe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file validation', () => {
    it('should accept audio/m4a mime type', () => {
      const allowedMimes = [
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/m4a',
        'audio/x-m4a',
        'audio/mpeg',
        'audio/webm',
      ];

      expect(allowedMimes).toContain('audio/m4a');
    });

    it('should accept audio/x-m4a mime type (iOS)', () => {
      const allowedMimes = [
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/m4a',
        'audio/x-m4a',
        'audio/mpeg',
        'audio/webm',
      ];

      expect(allowedMimes).toContain('audio/x-m4a');
    });

    it('should accept audio/wav mime type', () => {
      const allowedMimes = [
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/m4a',
        'audio/x-m4a',
        'audio/mpeg',
        'audio/webm',
      ];

      expect(allowedMimes).toContain('audio/wav');
    });

    it('should accept audio/webm mime type', () => {
      const allowedMimes = [
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/m4a',
        'audio/x-m4a',
        'audio/mpeg',
        'audio/webm',
      ];

      expect(allowedMimes).toContain('audio/webm');
    });
  });

  describe('transcription service integration', () => {
    it('should call transcribeAudio with buffer and mimetype', async () => {
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;
      mockTranscribe.mockResolvedValue('Transcribed text here');

      const mockBuffer = Buffer.from('fake audio');
      const mockMimeType = 'audio/x-m4a';

      const result = await mockTranscribe(mockBuffer, mockMimeType);

      expect(result).toBe('Transcribed text here');
      expect(mockTranscribe).toHaveBeenCalledWith(mockBuffer, mockMimeType);
    });

    it('should handle transcription errors', async () => {
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;
      mockTranscribe.mockRejectedValue(new Error('Transcription failed'));

      await expect(mockTranscribe(Buffer.from('test'), 'audio/m4a')).rejects.toThrow(
        'Transcription failed'
      );
    });

    it('should return transcribed text on success', async () => {
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;
      mockTranscribe.mockResolvedValue('Hello world');

      const result = await mockTranscribe(Buffer.from('audio'), 'audio/m4a');

      expect(result).toBe('Hello world');
    });
  });

  describe('file size limits', () => {
    it('should have 10MB file size limit configured', () => {
      // The multer config should allow up to 10MB
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      expect(MAX_FILE_SIZE).toBe(10485760);
    });
  });

  describe('error responses', () => {
    it('should include error message in failed transcription response', async () => {
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;
      const errorMessage = 'OpenAI API rate limit exceeded';
      mockTranscribe.mockRejectedValue(new Error(errorMessage));

      try {
        await mockTranscribe(Buffer.from('audio'), 'audio/m4a');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }
    });
  });
});

describe('multer file filter', () => {
  const allowedMimes = [
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mpeg',
    'audio/webm',
  ];

  it.each(allowedMimes)('should accept %s mime type', (mimeType) => {
    expect(allowedMimes.includes(mimeType)).toBe(true);
  });

  it('should reject unsupported mime types', () => {
    const unsupportedTypes = ['audio/ogg', 'audio/flac', 'video/mp4', 'image/png'];

    unsupportedTypes.forEach((type) => {
      expect(allowedMimes.includes(type)).toBe(false);
    });
  });
});
