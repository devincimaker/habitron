import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/openai.js', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('../services/coachDebugEvents.js', () => ({
  sessionBelongsToUser: vi.fn(),
}));

import { sendMessage } from '../services/openai.js';
import { sessionBelongsToUser } from '../services/coachDebugEvents.js';
import { createMockRequest, createMockResponse } from '../test/mocks.js';
import { handleChatRequest } from './chat.js';

describe('handleChatRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when sessionId is missing', async () => {
    const req = createMockRequest({
      body: {
        messages: [{ role: 'user', content: 'Help me plan today.' }],
        habits: [],
      },
    });
    const res = createMockResponse();

    await handleChatRequest(req as never, res as never);

    expect(sessionBelongsToUser).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'A valid coaching session is required.',
      code: 'session_required',
    });
  });

  it('returns 403 when sessionId does not belong to the user', async () => {
    const req = createMockRequest({
      body: {
        sessionId: 'session-123',
        messages: [{ role: 'user', content: 'Help me plan today.' }],
        habits: [],
      },
      user: { id: 'user-123', email: 'test@example.com' },
    });
    const res = createMockResponse();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    (sessionBelongsToUser as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await handleChatRequest(req as never, res as never);

    expect(sessionBelongsToUser).toHaveBeenCalledWith('session-123', 'user-123');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You do not have access to that coaching session.',
      code: 'session_forbidden',
    });

    warnSpy.mockRestore();
  });

  it('forwards an owned sessionId to sendMessage', async () => {
    const req = createMockRequest({
      body: {
        sessionId: 'session-123',
        messages: [{ role: 'user', content: 'Help me plan today.' }],
        habits: [],
        today: '2026-04-23',
        timezone: 'America/Argentina/Buenos_Aires',
      },
      user: { id: 'user-123', email: 'test@example.com' },
    });
    const res = createMockResponse();

    (sessionBelongsToUser as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'Here is a plan.',
      proposal: null,
      leadSkillId: 'day-planning',
      activeSkillIds: ['day-planning'],
      skillPhase: 'drafting',
    });

    await handleChatRequest(req as never, res as never);

    expect(sessionBelongsToUser).toHaveBeenCalledWith('session-123', 'user-123');
    expect(sendMessage).toHaveBeenCalledWith({
      sessionId: 'session-123',
      messages: [{ role: 'user', content: 'Help me plan today.' }],
      habits: [],
      goals: undefined,
      todos: undefined,
      journalEntries: undefined,
      dailyPlan: undefined,
      memories: undefined,
      userName: undefined,
      today: '2026-04-23',
      timezone: 'America/Argentina/Buenos_Aires',
    }, {
      userId: 'user-123',
    });
    expect(res.json).toHaveBeenCalledWith({
      message: 'Here is a plan.',
      proposal: null,
      leadSkillId: 'day-planning',
      activeSkillIds: ['day-planning'],
      skillPhase: 'drafting',
    });
  });
});
