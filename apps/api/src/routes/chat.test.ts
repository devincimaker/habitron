import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachStreamEvent } from '@habits-coach/shared';

vi.mock('../coach/agent.js', () => ({
  runCoachTurn: vi.fn(),
}));

vi.mock('../services/coachSessions.js', () => ({
  findCoachSession: vi.fn(),
  recordTurn: vi.fn(),
  setClaudeSessionId: vi.fn(),
}));

import { runCoachTurn } from '../coach/agent.js';
import { findCoachSession, recordTurn, setClaudeSessionId } from '../services/coachSessions.js';
import { createMockRequest } from '../test/mocks.js';
import { handleChatRequest } from './chat.js';

const mockedRunCoachTurn = runCoachTurn as ReturnType<typeof vi.fn>;
const mockedFindCoachSession = findCoachSession as ReturnType<typeof vi.fn>;
const mockedRecordTurn = recordTurn as ReturnType<typeof vi.fn>;
const mockedSetClaudeSessionId = setClaudeSessionId as ReturnType<typeof vi.fn>;

function createStreamingResponse() {
  const chunks: string[] = [];
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn(),
  };
  const events = () =>
    chunks
      .filter((chunk) => chunk.startsWith('data: '))
      .map((chunk) => JSON.parse(chunk.slice('data: '.length)) as CoachStreamEvent);
  return { res, events };
}

function createRequest(body: Record<string, unknown>) {
  const listeners: Record<string, () => void> = {};
  const req = createMockRequest({
    body,
    user: { id: 'user-123', email: 'test@example.com' },
    on: vi.fn((event: string, listener: () => void) => (listeners[event] = listener)),
  });
  return Object.assign(req, { disconnect: () => listeners.close() });
}

describe('handleChatRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockedRecordTurn.mockResolvedValue(undefined);
  });

  it('returns 400 when sessionId is missing', async () => {
    const req = createRequest({ prompt: 'Help me plan today.', timezone: 'UTC' });
    const { res } = createStreamingResponse();

    await handleChatRequest(req as never, res as never);

    expect(mockedFindCoachSession).not.toHaveBeenCalled();
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'A valid coaching session is required.',
      code: 'session_required',
    });
  });

  it('returns 400 when the prompt is empty', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: '   ', timezone: 'UTC' });
    const { res } = createStreamingResponse();

    await handleChatRequest(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();
  });

  it('returns 403 when the session does not belong to the user', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: 'Hi', timezone: 'UTC' });
    const { res } = createStreamingResponse();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedFindCoachSession.mockResolvedValue(null);

    await handleChatRequest(req as never, res as never);

    expect(mockedFindCoachSession).toHaveBeenCalledWith('session-123', 'user-123');
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You do not have access to that coaching session.',
      code: 'session_forbidden',
    });

    warnSpy.mockRestore();
  });

  it('streams the turn as server-sent events and stores the new Claude session id', async () => {
    const req = createRequest({
      sessionId: 'session-123',
      prompt: '/coach',
      timezone: 'America/Argentina/Buenos_Aires',
      userName: 'Mauro',
    });
    const { res, events } = createStreamingResponse();
    mockedFindCoachSession.mockResolvedValue({ id: 'session-123', claudeSessionId: null });
    mockedRunCoachTurn.mockImplementation(async (_input, onEvent: (event: CoachStreamEvent) => void) => {
      onEvent({ type: 'session', claudeSessionId: 'claude-abc' });
      onEvent({ type: 'tool', name: 'get_day_context' });
      onEvent({ type: 'text', delta: 'You have 3 tasks today.' });
      onEvent({ type: 'done', message: 'You have 3 tasks today.' });
      return { text: 'You have 3 tasks today.', claudeSessionId: 'claude-abc' };
    });

    await handleChatRequest(req as never, res as never);

    expect(mockedRunCoachTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        prompt: '/coach',
        timezone: 'America/Argentina/Buenos_Aires',
        userName: 'Mauro',
        claudeSessionId: null,
      }),
      expect.any(Function)
    );
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
    expect(events()).toEqual([
      { type: 'session', claudeSessionId: 'claude-abc' },
      { type: 'tool', name: 'get_day_context' },
      { type: 'text', delta: 'You have 3 tasks today.' },
      { type: 'done', message: 'You have 3 tasks today.' },
    ]);
    expect(mockedSetClaudeSessionId).toHaveBeenCalledWith('session-123', 'user-123', 'claude-abc');
    expect(res.end).toHaveBeenCalled();
  });

  it('records the turn on the session before it starts and again when it ends', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: '  Plan my day  ', timezone: 'UTC' });
    const { res } = createStreamingResponse();
    mockedFindCoachSession.mockResolvedValue({ id: 'session-123', claudeSessionId: 'claude-abc' });
    mockedRunCoachTurn.mockImplementation(async () => {
      expect(mockedRecordTurn).toHaveBeenCalledWith('session-123', 'user-123', {
        prompt: 'Plan my day',
        status: 'running',
      });
      return { text: 'Here is the plan.', claudeSessionId: 'claude-abc' };
    });

    await handleChatRequest(req as never, res as never);

    expect(mockedRecordTurn).toHaveBeenLastCalledWith('session-123', 'user-123', {
      prompt: 'Plan my day',
      status: 'done',
      reply: 'Here is the plan.',
    });
    expect(res.writeHead).toHaveBeenCalled();
    expect(mockedRecordTurn.mock.invocationCallOrder[0]).toBeLessThan(res.writeHead.mock.invocationCallOrder[0]);
  });

  it('keeps the turn running and records its reply when the client disconnects mid-turn', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: 'Plan my day', timezone: 'UTC' });
    const { res, events } = createStreamingResponse();
    mockedFindCoachSession.mockResolvedValue({ id: 'session-123', claudeSessionId: 'claude-abc' });
    mockedRunCoachTurn.mockImplementation(
      async (input: { signal: AbortSignal }, onEvent: (event: CoachStreamEvent) => void) => {
        onEvent({ type: 'text', delta: 'Here ' });
        req.disconnect();
        expect(input.signal.aborted).toBe(false);
        onEvent({ type: 'text', delta: 'is the plan.' });
        onEvent({ type: 'done', message: 'Here is the plan.' });
        return { text: 'Here is the plan.', claudeSessionId: 'claude-abc' };
      }
    );

    await handleChatRequest(req as never, res as never);

    expect(events()).toEqual([{ type: 'text', delta: 'Here ' }]);
    expect(mockedRecordTurn).toHaveBeenLastCalledWith('session-123', 'user-123', {
      prompt: 'Plan my day',
      status: 'done',
      reply: 'Here is the plan.',
    });
  });

  it('returns 500 without opening the stream when the turn cannot be recorded', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: 'Hi', timezone: 'UTC' });
    const { res } = createStreamingResponse();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedFindCoachSession.mockResolvedValue({ id: 'session-123', claudeSessionId: null });
    mockedRecordTurn.mockRejectedValueOnce(new Error('db down'));

    await handleChatRequest(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('resumes an existing Claude session without rewriting its id', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: 'Yes, save it.', timezone: 'UTC' });
    const { res } = createStreamingResponse();
    mockedFindCoachSession.mockResolvedValue({ id: 'session-123', claudeSessionId: 'claude-abc' });
    mockedRunCoachTurn.mockResolvedValue({ text: 'Saved.', claudeSessionId: 'claude-abc' });

    await handleChatRequest(req as never, res as never);

    expect(mockedRunCoachTurn).toHaveBeenCalledWith(
      expect.objectContaining({ claudeSessionId: 'claude-abc' }),
      expect.any(Function)
    );
    expect(mockedSetClaudeSessionId).not.toHaveBeenCalled();
  });

  it('sends an error event when the turn throws', async () => {
    const req = createRequest({ sessionId: 'session-123', prompt: 'Hi', timezone: 'UTC' });
    const { res, events } = createStreamingResponse();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedFindCoachSession.mockResolvedValue({ id: 'session-123', claudeSessionId: null });
    mockedRunCoachTurn.mockRejectedValue(new Error('boom'));

    await handleChatRequest(req as never, res as never);

    expect(events()).toEqual([
      { type: 'error', message: 'The coach ran into a problem. Please try again.' },
    ]);
    expect(mockedRecordTurn).toHaveBeenLastCalledWith('session-123', 'user-123', {
      prompt: 'Hi',
      status: 'failed',
      error: 'The coach ran into a problem. Please try again.',
    });
    expect(res.end).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
