import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/instructQueue.js', () => ({
  instructQueue: vi.fn(),
}));
vi.mock('../services/transcription.js', () => ({
  transcribeAudio: vi.fn(),
}));

import { createMockRequest } from '../test/mocks.js';
import { instructQueue } from '../services/instructQueue.js';
import { transcribeAudio } from '../services/transcription.js';
import type { InstructActionRecord } from '../services/instructActions.js';
import { handleEnqueueRequest } from './instruct.js';

const mockedQueue = instructQueue as ReturnType<typeof vi.fn>;
const mockedTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;

const RECORD: InstructActionRecord = {
  id: 'a4b1c2d3-0000-4000-8000-000000000001',
  user_id: 'user-123',
  status: 'queued',
  transcript: 'move gym to 6pm',
  timezone: 'UTC',
  summary: null,
  result: null,
  error: null,
  tool_calls: null,
  claude_session_id: null,
  reinstruct_of: null,
  created_at: '2026-09-01T10:00:00Z',
  started_at: null,
  finished_at: null,
};

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function createRequest(body: Record<string, unknown>, file?: { buffer: Buffer; mimetype: string }) {
  const req = createMockRequest({
    body: { timezone: 'UTC', ...body },
    user: { id: 'user-123', email: 'test@example.com' },
  }) as Record<string, unknown>;
  req.file = file;
  return req;
}

describe('handleEnqueueRequest', () => {
  const enqueue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    enqueue.mockResolvedValue(RECORD);
    mockedQueue.mockReturnValue({ enqueue });
  });

  it('rejects a request without a timezone', async () => {
    const res = createResponse();
    await handleEnqueueRequest(createRequest({ timezone: ' ' }) as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues text directly, skipping transcription', async () => {
    const res = createResponse();
    await handleEnqueueRequest(createRequest({ text: ' move gym to 6pm ' }) as never, res as never);

    expect(mockedTranscribe).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith({
      userId: 'user-123',
      transcript: 'move gym to 6pm',
      timezone: 'UTC',
      reinstructOf: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({
      action: expect.objectContaining({ id: RECORD.id, status: 'queued', transcript: 'move gym to 6pm' }),
    });
  });

  it('transcribes an uploaded recording and enqueues the transcript', async () => {
    mockedTranscribe.mockResolvedValue(' move gym to 6pm ');
    const res = createResponse();
    const file = { buffer: Buffer.from('audio'), mimetype: 'audio/x-m4a' };

    await handleEnqueueRequest(createRequest({}, file) as never, res as never);

    expect(mockedTranscribe).toHaveBeenCalledWith(file.buffer, file.mimetype);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ transcript: 'move gym to 6pm' }));
  });

  it('answers 422 when nothing intelligible was said', async () => {
    mockedTranscribe.mockResolvedValue('  ');
    const res = createResponse();

    await handleEnqueueRequest(createRequest({}, { buffer: Buffer.from(''), mimetype: 'audio/x-m4a' }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('passes a valid reinstructOf through and rejects a malformed one', async () => {
    const res = createResponse();
    await handleEnqueueRequest(
      createRequest({ text: 'no, 7pm', reinstructOf: RECORD.id }) as never,
      res as never
    );
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ reinstructOf: RECORD.id }));

    const bad = createResponse();
    await handleEnqueueRequest(
      createRequest({ text: 'no, 7pm', reinstructOf: 'not-a-uuid' }) as never,
      bad as never
    );
    expect(bad.status).toHaveBeenCalledWith(400);
  });
});
