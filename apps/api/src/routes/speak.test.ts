import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createStreamingRequest, createStreamingResponse } from '../test/mocks.js';

vi.mock('../services/speech.js', () => ({
  SPEECH_MIME_TYPE: 'audio/pcm',
  SPEECH_SAMPLE_RATE: 24_000,
  synthesizeSpeech: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn(),
}));

import { synthesizeSpeech } from '../services/speech.js';
import { handleSpeakRequest } from './speak.js';

const mockSynthesize = vi.mocked(synthesizeSpeech);

function pcmStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('POST /api/speak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request without text', async () => {
    const req = createStreamingRequest({ body: {} });
    const { res } = createStreamingResponse();

    await handleSpeakRequest(req as unknown as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSynthesize).not.toHaveBeenCalled();
  });

  it('rejects text longer than one sentence could be', async () => {
    const req = createStreamingRequest({ body: { text: 'a'.repeat(1_001) } });
    const { res } = createStreamingResponse();

    await handleSpeakRequest(req as unknown as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSynthesize).not.toHaveBeenCalled();
  });

  it('streams the synthesised audio as PCM and passes the stitching context along', async () => {
    const chunks = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6])];
    mockSynthesize.mockResolvedValue(pcmStream(chunks));
    const req = createStreamingRequest({
      body: { text: 'How did today go?', previousText: 'Good evening.', nextText: 'Take your time.' },
    });
    const { res } = createStreamingResponse();

    await handleSpeakRequest(req as unknown as Request, res as unknown as Response);

    expect(mockSynthesize).toHaveBeenCalledWith(
      { text: 'How did today go?', previousText: 'Good evening.', nextText: 'Take your time.' },
      expect.any(AbortSignal)
    );
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'audio/pcm', 'X-Sample-Rate': '24000' })
    );
    expect(res.write).toHaveBeenCalledTimes(2);
    expect(res.write).toHaveBeenNthCalledWith(1, chunks[0]);
    expect(res.write).toHaveBeenNthCalledWith(2, chunks[1]);
    expect(res.end).toHaveBeenCalled();
  });

  it('answers 502 when the provider fails before any audio', async () => {
    mockSynthesize.mockRejectedValue(new Error('ElevenLabs returned 401'));
    const req = createStreamingRequest({ body: { text: 'Hello.' } });
    const { res } = createStreamingResponse();

    await handleSpeakRequest(req as unknown as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('cancels the provider request when the client hangs up', async () => {
    let seenSignal: AbortSignal | undefined;
    mockSynthesize.mockImplementation(async (_request, signal) => {
      seenSignal = signal;
      return pcmStream([]);
    });
    const req = createStreamingRequest({ body: { text: 'Hello.' } });
    const { res } = createStreamingResponse();

    await handleSpeakRequest(req as unknown as Request, res as unknown as Response);
    req.disconnect();

    expect(seenSignal?.aborted).toBe(true);
  });
});
