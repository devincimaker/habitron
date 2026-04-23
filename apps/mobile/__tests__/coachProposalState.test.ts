import type { ChatMessage } from '@habits-coach/shared';
import {
  getLatestCoachProposal,
  getPendingCoachProposal,
} from '../utils/coachProposal';

function createMessage(message: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role' | 'content'>): ChatMessage {
  return {
    timestamp: Date.now(),
    ...message,
  };
}

describe('getPendingCoachProposal', () => {
  it('returns the latest unresolved assistant proposal', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'First idea',
        proposal: { actions: [{ entity: 'habit', operation: 'create', habit: { name: 'Walk', frequency: 'daily' } }] },
      }),
      createMessage({
        id: 'assistant-2',
        role: 'assistant',
        content: 'Second idea',
        proposal: { actions: [{ entity: 'habit', operation: 'archive', habitId: 'habit-1' }] },
      }),
    ];

    const result = getPendingCoachProposal(messages, new Set(['assistant-1']));

    expect(result?.messageId).toBe('assistant-2');
    expect(result?.proposal.actions[0]).toMatchObject({
      entity: 'habit',
      operation: 'archive',
    });
  });

  it('skips proposals that have already been resolved', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'Only idea',
        proposal: { actions: [{ entity: 'habit', operation: 'create', habit: { name: 'Creatine', frequency: 'daily' } }] },
      }),
    ];

    const result = getPendingCoachProposal(messages, new Set(['assistant-1']));

    expect(result).toBeNull();
  });

  it('ignores assistant messages without a proposal', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'Let me think about that.',
      }),
    ];

    const result = getPendingCoachProposal(messages, new Set());

    expect(result).toBeNull();
  });

  it('skips malformed proposals that cannot be executed', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'Bad proposal',
        proposal: { actions: [{ entity: 'habit', operation: 'archive', habitId: undefined as never }] },
      }),
      createMessage({
        id: 'assistant-2',
        role: 'assistant',
        content: 'Good proposal',
        proposal: { actions: [{ entity: 'habit', operation: 'create', habit: { name: 'Creatine', frequency: 'daily' } }] },
      }),
    ];

    const result = getPendingCoachProposal(messages, new Set(['assistant-2']));

    expect(result).toBeNull();
  });
});

describe('getLatestCoachProposal', () => {
  it('returns the latest valid proposal even when earlier proposals exist', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'First idea',
        proposal: {
          actions: [
            { entity: 'habit', operation: 'create', habit: { name: 'Walk', frequency: 'daily' } },
          ],
        },
      }),
      createMessage({
        id: 'assistant-2',
        role: 'assistant',
        content: 'Second idea',
        proposal: {
          actions: [{ entity: 'habit', operation: 'archive', habitId: 'habit-1' }],
        },
      }),
    ];

    const result = getLatestCoachProposal(messages);

    expect(result?.messageId).toBe('assistant-2');
    expect(result?.proposal.actions[0]).toMatchObject({
      entity: 'habit',
      operation: 'archive',
    });
  });

  it('skips malformed proposals and falls back to the latest executable one', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'Good proposal',
        proposal: {
          actions: [
            {
              entity: 'habit',
              operation: 'create',
              habit: { name: 'Creatine', frequency: 'daily' },
            },
          ],
        },
      }),
      createMessage({
        id: 'assistant-2',
        role: 'assistant',
        content: 'Bad proposal',
        proposal: {
          actions: [{ entity: 'habit', operation: 'archive', habitId: undefined as never }],
        },
      }),
    ];

    const result = getLatestCoachProposal(messages);

    expect(result?.messageId).toBe('assistant-1');
    expect(result?.proposal.actions[0]).toMatchObject({
      entity: 'habit',
      operation: 'create',
    });
  });
});
