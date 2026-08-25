import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachStreamEvent } from '@habits-coach/shared';

vi.mock('../coach/agent.js', () => ({
  INSTRUCT_SKILLS: ['instruct'],
  runCoachTurn: vi.fn(),
}));

import { runCoachTurn } from '../coach/agent.js';
import { createMockRequest } from '../test/mocks.js';
import { APPLY_PROMPT, handleInstructRequest } from './instruct.js';

const mockedRunCoachTurn = runCoachTurn as ReturnType<typeof vi.fn>;

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
  return createMockRequest({
    body: { timezone: 'UTC', ...body },
    user: { id: 'user-123', email: 'test@example.com' },
    on: vi.fn(),
  });
}

describe('handleInstructRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunCoachTurn.mockResolvedValue({ text: '', claudeSessionId: 'claude-abc' });
  });

  it('rejects an unknown kind', async () => {
    const { res } = createStreamingResponse();

    await handleInstructRequest(createRequest({ kind: 'chat', text: 'hi' }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();
  });

  it('rejects a proposal without text', async () => {
    const { res } = createStreamingResponse();

    await handleInstructRequest(createRequest({ kind: 'propose', text: '  ' }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();
  });

  it('rejects a correction or apply without a session to resume', async () => {
    for (const body of [{ kind: 'correct', text: 'Friday, not Thursday' }, { kind: 'apply' }]) {
      const { res } = createStreamingResponse();
      await handleInstructRequest(createRequest(body) as never, res as never);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(mockedRunCoachTurn).not.toHaveBeenCalled();
  });

  it('proposes with the instruct skill, read-only tools and no session', async () => {
    const { res, events } = createStreamingResponse();
    mockedRunCoachTurn.mockImplementation(async (_input, onEvent: (event: CoachStreamEvent) => void) => {
      onEvent({ type: 'session', claudeSessionId: 'claude-abc' });
      onEvent({ type: 'tool', name: 'list_tasks' });
      onEvent({ type: 'done', message: 'Reschedule one task\n- Move Run to Thursday' });
      return { text: 'Reschedule one task\n- Move Run to Thursday', claudeSessionId: 'claude-abc' };
    });

    await handleInstructRequest(
      createRequest({ kind: 'propose', text: ' move my run to Thursday ', userName: 'Mauro' }) as never,
      res as never
    );

    expect(mockedRunCoachTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        prompt: '/instruct move my run to Thursday',
        timezone: 'UTC',
        userName: 'Mauro',
        claudeSessionId: null,
        skills: ['instruct'],
        readOnly: true,
      }),
      expect.any(Function)
    );
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
    expect(events()).toEqual([
      { type: 'session', claudeSessionId: 'claude-abc' },
      { type: 'tool', name: 'list_tasks' },
      { type: 'done', message: 'Reschedule one task\n- Move Run to Thursday' },
    ]);
    expect(res.end).toHaveBeenCalled();
  });

  it('corrects by resuming the session, still read-only', async () => {
    const { res } = createStreamingResponse();

    await handleInstructRequest(
      createRequest({ kind: 'correct', text: 'no, Friday', claudeSessionId: 'claude-abc' }) as never,
      res as never
    );

    expect(mockedRunCoachTurn).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Correction: no, Friday', claudeSessionId: 'claude-abc', readOnly: true }),
      expect.any(Function)
    );
  });

  it('applies by resuming the session with the full tool set', async () => {
    const { res } = createStreamingResponse();

    await handleInstructRequest(createRequest({ kind: 'apply', claudeSessionId: 'claude-abc' }) as never, res as never);

    expect(mockedRunCoachTurn).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: APPLY_PROMPT, claudeSessionId: 'claude-abc', readOnly: false }),
      expect.any(Function)
    );
  });

  it('sends an error event when the turn throws', async () => {
    const { res, events } = createStreamingResponse();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedRunCoachTurn.mockRejectedValue(new Error('boom'));

    await handleInstructRequest(createRequest({ kind: 'propose', text: 'add milk' }) as never, res as never);

    expect(events()).toEqual([{ type: 'error', message: 'The coach ran into a problem. Please try again.' }]);
    expect(res.end).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
