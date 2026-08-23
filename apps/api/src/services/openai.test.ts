import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a hoisted mock reference
const mockChatCompletionsCreate = vi.hoisted(() => vi.fn());
const mockTranscriptionsCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockChatCompletionsCreate,
        },
      };
      audio = {
        transcriptions: {
          create: mockTranscriptionsCreate,
        },
      };
    },
  };
});

// Mock the config
vi.mock('../config.js', () => ({
  config: {
    supabase: {
      url: 'https://example.supabase.co',
      serviceRoleKey: 'test-service-role-key',
    },
    openai: {
      apiKey: 'test-api-key',
      model: 'gpt-4',
    },
  },
}));

import { sendMessage, transcribeAudio } from './openai.js';

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCompletionsCreate.mockReset();
    mockTranscriptionsCreate.mockReset();
  });

  it('routes explicit planning requests through the day-planning skill', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'Before I draft anything, what matters most today and how much energy do you have?',
              proposal: null,
            }),
          },
        },
      ],
    });

    await sendMessage({
      messages: [{ role: 'user', content: 'Plan my day.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
      timezone: 'America/Argentina/Buenos_Aires',
    });

    const call = mockChatCompletionsCreate.mock.calls[0][0];
    const systemPrompt = call.messages
      .filter((message: { role: string }) => message.role === 'system')
      .map((message: { content: string }) => message.content)
      .join('\n\n');

    expect(systemPrompt).toContain('id: day-planning');
    expect(systemPrompt).toContain('This is not a one-shot planner generator.');
    expect(systemPrompt).toContain('## Planning Packet');
  });

  it('keeps non-planning requests on the general coach skill', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'Let’s talk about that habit friction first.',
              proposal: null,
            }),
          },
        },
      ],
    });

    await sendMessage({
      messages: [{ role: 'user', content: 'Why do I keep dropping this habit after three days?' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    const call = mockChatCompletionsCreate.mock.calls[0][0];
    const systemPrompt = call.messages
      .filter((message: { role: string }) => message.role === 'system')
      .map((message: { content: string }) => message.content)
      .join('\n\n');

    expect(systemPrompt).toContain('id: general-coach');
    expect(systemPrompt).not.toContain('## Planning Packet');
    expect(call.tools).toBeUndefined();
    expect(call.tool_choice).toBeUndefined();
    expect(call.parallel_tool_calls).toBeUndefined();
  });

  it('routes task-management turns through task tools instead of a raw task dump', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I can help clean these up.',
              proposal: null,
            }),
          },
        },
      ],
    });

    await sendMessage({
      messages: [{ role: 'user', content: 'Please prune the duplicate tasks.' }],
      habits: [],
      goals: [],
      todos: [
        {
          id: 'todo-1',
          title: 'Buy groceries',
          status: 'open',
          sortOrder: 1,
          listId: 'list-1',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
    });

    const call = mockChatCompletionsCreate.mock.calls[0][0];
    const systemPrompt = call.messages
      .filter((message: { role: string }) => message.role === 'system')
      .map((message: { content: string }) => message.content)
      .join('\n\n');

    expect(systemPrompt).toContain('id: task-management');
    expect(systemPrompt).toContain('## Task Overview Snapshot');
    expect(systemPrompt).toContain('## Task Tools');
    expect(systemPrompt).not.toContain('## Tasks\n- "Buy groceries"');
    expect(call.tools).toHaveLength(4);
  });

  it('can use task tools before returning a grounded duplicate-cleanup proposal', async () => {
    mockChatCompletionsCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'tool-call-1',
                  type: 'function',
                  function: {
                    name: 'find_duplicate_tasks',
                    arguments: JSON.stringify({ limit: 4 }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: 'I found the duplicate tasks and kept the freshest copy.',
                proposal: {
                  actions: [
                    {
                      entity: 'todo',
                      operation: 'remove',
                      todoId: 'todo-2',
                    },
                    {
                      entity: 'todo',
                      operation: 'remove',
                      todoId: 'todo-3',
                    },
                  ],
                },
              }),
            },
          },
        ],
      });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Please prune the duplicate tasks.' }],
      habits: [],
      goals: [],
      todos: [
        {
          id: 'todo-1',
          title: 'Buy groceries',
          status: 'open',
          sortOrder: 1,
          listId: 'list-1',
          createdAt: 1,
          updatedAt: 10,
        },
        {
          id: 'todo-2',
          title: 'Buy groceries',
          status: 'open',
          sortOrder: 2,
          listId: 'list-1',
          createdAt: 2,
          updatedAt: 9,
        },
        {
          id: 'todo-3',
          title: 'Buy groceries',
          status: 'open',
          sortOrder: 3,
          listId: 'list-1',
          createdAt: 3,
          updatedAt: 8,
        },
      ],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
    });

    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
    expect(result.proposal?.actions).toEqual([
      { entity: 'todo', operation: 'remove', todoId: 'todo-2' },
      { entity: 'todo', operation: 'remove', todoId: 'todo-3' },
    ]);
  });

  it('drops unresolved destructive task actions before they reach the client', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I pruned the duplicate tasks.',
              proposal: {
                actions: [
                  {
                    entity: 'todo',
                    operation: 'remove',
                    todoId: 'missing-task',
                  },
                ],
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Please prune the duplicate tasks.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
    });

    expect(result.proposal).toBeNull();
  });

  it('normalizes proposals without actions to an empty array', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'Here is a focused day plan.',
              proposal: {
                dailyPlanDraft: {
                  date: '2026-03-24',
                  rationale: 'Protect the morning for deep work.',
                  items: [
                    {
                      itemType: 'note',
                      title: 'Deep work block',
                      scheduledBlock: 'morning',
                    },
                  ],
                },
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Plan my day.' }],
      habits: [],
      goals: [],
      todos: [
        {
          id: 'todo-1',
          title: 'Existing task',
          status: 'open',
          sortOrder: 1,
          listId: 'list-1',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
      timezone: 'America/Argentina/Buenos_Aires',
    });

    expect(result.proposal?.actions).toEqual([]);
    expect(result.proposal?.dailyPlanDraft?.date).toBe('2026-03-24');
  });

  it('wraps a single proposal action in an array', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I added the task.',
              proposal: {
                actions: {
                  entity: 'todo',
                  operation: 'add',
                  todo: {
                    title: 'Send invoice',
                  },
                },
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Add a task.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    expect(result.proposal?.actions).toHaveLength(1);
    expect(result.proposal?.actions[0]).toMatchObject({
      entity: 'todo',
      operation: 'add',
    });
  });

  it('normalizes time block variants in task actions and daily plan items', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'Here is a draft.',
              proposal: {
                actions: [
                  {
                    entity: 'todo',
                    operation: 'add',
                    todo: {
                      title: 'Buy groceries',
                      scheduledBlock: 'Late Afternoon',
                    },
                  },
                  {
                    entity: 'todo',
                    operation: 'schedule',
                    todoId: 'todo-1',
                    scheduledDate: '2026-03-24',
                    scheduledBlock: 'Tonight',
                  },
                ],
                dailyPlanDraft: {
                  date: '2026-03-24',
                  items: [
                    {
                      itemType: 'todo',
                      title: 'Buy groceries',
                      scheduledBlock: 'Late Afternoon',
                    },
                  ],
                },
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Plan my day.' }],
      habits: [],
      goals: [],
      todos: [
        {
          id: 'todo-1',
          title: 'Existing task',
          status: 'open',
          sortOrder: 1,
          listId: 'list-1',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
      timezone: 'America/Argentina/Buenos_Aires',
    });

    expect(result.proposal?.actions[0]).toMatchObject({
      entity: 'todo',
      operation: 'add',
      todo: expect.objectContaining({
        scheduledTime: '13:00',
      }),
    });
    expect(result.proposal?.actions[1]).toMatchObject({
      entity: 'todo',
      operation: 'schedule',
      scheduledTime: '18:00',
    });
    expect(result.proposal?.dailyPlanDraft?.items[0]).toMatchObject({
      scheduledTime: '13:00',
    });
  });

  it('strips invalid time blocks before they reach the client', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'Here is a draft.',
              proposal: {
                actions: [
                  {
                    entity: 'todo',
                    operation: 'add',
                    todo: {
                      title: 'Clean kitchen',
                      scheduledBlock: 'whenever works',
                    },
                  },
                ],
                dailyPlanDraft: {
                  date: '2026-03-24',
                  items: [
                    {
                      itemType: 'todo',
                      title: 'Clean kitchen',
                      scheduledBlock: 'whenever works',
                    },
                  ],
                },
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Plan my day.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
      today: '2026-03-24',
      timezone: 'America/Argentina/Buenos_Aires',
    });

    expect(result.proposal?.actions[0]).toMatchObject({
      entity: 'todo',
      operation: 'add',
      todo: expect.not.objectContaining({
        scheduledTime: expect.anything(),
      }),
    });
    expect(result.proposal?.dailyPlanDraft).toBeNull();
  });

  it('parses markdown-wrapped JSON responses defensively', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n{"message":"Okay","proposal":null}\n```',
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Help me think.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    expect(result.message).toBe('Okay');
    expect(result.proposal).toBeNull();
  });
});

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCompletionsCreate.mockReset();
    mockTranscriptionsCreate.mockReset();
  });

  it('should transcribe audio buffer and return text', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Hello, this is a test.' });

    const audioBuffer = Buffer.from('fake audio data');
    const result = await transcribeAudio(audioBuffer, 'audio/m4a');

    expect(result).toBe('Hello, this is a test.');
    expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'whisper-1',
      })
    );
  });

  it('should use correct file extension for audio/m4a', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/m4a');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.m4a');
    expect(call.file.type).toBe('audio/m4a');
  });

  it('should use correct file extension for audio/x-m4a', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/x-m4a');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.m4a');
    expect(call.file.type).toBe('audio/x-m4a');
  });

  it('should use correct file extension for audio/wav', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/wav');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.wav');
    expect(call.file.type).toBe('audio/wav');
  });

  it('should use correct file extension for audio/x-wav', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/x-wav');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.wav');
  });

  it('should use correct file extension for audio/mpeg (mp3)', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/mpeg');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.mp3');
  });

  it('should use correct file extension for audio/webm', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/webm');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.webm');
  });

  it('should default to wav extension for unknown mime types', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

    const audioBuffer = Buffer.from('fake audio data');
    await transcribeAudio(audioBuffer, 'audio/unknown');

    const call = mockTranscriptionsCreate.mock.calls[0][0];
    expect(call.file.name).toBe('audio.wav');
  });

  it('should propagate OpenAI API errors', async () => {
    mockTranscriptionsCreate.mockRejectedValue(new Error('OpenAI API rate limit exceeded'));

    const audioBuffer = Buffer.from('fake audio data');

    await expect(transcribeAudio(audioBuffer, 'audio/m4a')).rejects.toThrow(
      'OpenAI API rate limit exceeded'
    );
  });

  it('should handle empty transcription result', async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: '' });

    const audioBuffer = Buffer.from('fake audio data');
    const result = await transcribeAudio(audioBuffer, 'audio/m4a');

    expect(result).toBe('');
  });
});
