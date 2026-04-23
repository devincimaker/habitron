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
    openai: {
      apiKey: 'test-api-key',
      model: 'gpt-4o-mini',
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
                      scheduledTime: '09:00',
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

  it('requests structured json schema for supported chat models', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I can help with that.',
              proposal: null,
            }),
          },
        },
      ],
    });

    await sendMessage({
      messages: [{ role: 'user', content: 'Help me build a habit.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    const params = mockChatCompletionsCreate.mock.calls[0][0];
    expect(params.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'coach_chat_response',
        strict: true,
      },
    });

    const schemaText = JSON.stringify(params.response_format.json_schema.schema);
    expect(schemaText).toContain('"name"');
    expect(schemaText).toContain('"timeOfDay"');
    expect(schemaText).toContain('"required":["title","description","status","priority","targetDate"]');
    expect(schemaText).toContain('"required":["name","frequency","weeklyDays","weeklyCount","timeOfDay","reason","icon"]');
  });

  it('instructs the coach to diagnose ambiguous habit resistance before proposing a change', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'What is making you want to stop that right now?',
              proposal: null,
            }),
          },
        },
      ],
    });

    await sendMessage({
      messages: [{ role: 'user', content: "I don't want to take creatine anymore." }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    const params = mockChatCompletionsCreate.mock.calls[0][0];
    const systemPrompt = params.messages[0].content;

    expect(systemPrompt).toContain('do not jump straight to an operation');
    expect(systemPrompt).toContain('Ask one brief diagnostic follow-up first and keep `proposal` as null');
    expect(systemPrompt).toContain('Do not ask the user to choose between operations like create / contract / archive');
    expect(systemPrompt).toContain('not an automatic archive command');
  });

  it('accepts valid habit create actions that use the app schema', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I will create that habit for you.',
              proposal: {
                actions: {
                  entity: 'habit',
                  operation: 'create',
                  habit: {
                    name: 'Take creatine',
                    frequency: 'daily',
                    timeOfDay: 'anytime',
                    reason: 'Support your strength goal.',
                  },
                },
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Make creatine a habit.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    expect(result.proposal?.actions).toHaveLength(1);
    expect(result.proposal?.actions[0]).toMatchObject({
      entity: 'habit',
      operation: 'create',
      habit: {
        name: 'Take creatine',
        frequency: 'daily',
        timeOfDay: 'anytime',
      },
    });
  });

  it('accepts goal add actions with nullable optional fields and strips nulls', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I added that goal.',
              proposal: {
                actions: {
                  entity: 'goal',
                  operation: 'add',
                  goal: {
                    title: 'Reach 90kg',
                    description: null,
                    status: null,
                    priority: null,
                    targetDate: null,
                  },
                },
              },
            }),
          },
        },
      ],
    });

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Add a new goal.' }],
      habits: [],
      goals: [],
      todos: [],
      journalEntries: [],
      dailyPlan: null,
      memories: [],
    });

    expect(result.proposal?.actions[0]).toMatchObject({
      entity: 'goal',
      operation: 'add',
      goal: {
        title: 'Reach 90kg',
      },
    });
    expect((result.proposal?.actions[0] as Extract<typeof result.proposal.actions[number], { entity: 'goal' }>).goal)
      .not.toHaveProperty('description');
  });

  it('accepts todo add actions with nullable optional fields and strips nulls', async () => {
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
                    notes: null,
                    priority: null,
                    dueDate: null,
                    scheduledDate: null,
                    scheduledTime: null,
                    estimateMinutes: null,
                    listId: null,
                    listName: null,
                    goalId: null,
                    tagIds: null,
                    tagNames: null,
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

    expect(result.proposal?.actions[0]).toMatchObject({
      entity: 'todo',
      operation: 'add',
      todo: {
        title: 'Send invoice',
      },
    });
    expect((result.proposal?.actions[0] as Extract<typeof result.proposal.actions[number], { entity: 'todo' }>).todo)
      .not.toHaveProperty('notes');
  });

  it('rejects malformed habit create actions without a name', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'Let’s make that a habit.',
              proposal: {
                actions: {
                  entity: 'habit',
                  operation: 'create',
                  habit: {
                    frequency: 'daily',
                  },
                },
              },
            }),
          },
        },
      ],
    });

    await expect(
      sendMessage({
        messages: [{ role: 'user', content: 'Make creatine a habit.' }],
        habits: [],
        goals: [],
        todos: [],
        journalEntries: [],
        dailyPlan: null,
        memories: [],
      })
    ).rejects.toThrow('habit create action must include a name');
  });

  it('rejects habit archive actions that reference unknown habits', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I can archive that habit for you.',
              proposal: {
                actions: {
                  entity: 'habit',
                  operation: 'archive',
                  habitId: 'habit-missing',
                },
              },
            }),
          },
        },
      ],
    });

    await expect(
      sendMessage({
        messages: [{ role: 'user', content: 'Archive that habit.' }],
        habits: [
          {
            id: 'habit-1',
            name: 'Take creatine',
            frequency: 'daily',
            active: true,
            createdAt: Date.now(),
          },
        ],
        goals: [],
        todos: [],
        journalEntries: [],
        dailyPlan: null,
        memories: [],
      })
    ).rejects.toThrow('habit archive action references an unknown habitId');
  });

  it('rejects proposals that apply multiple changes to the same habit', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I can deactivate that habit.',
              proposal: {
                actions: [
                  {
                    entity: 'habit',
                    operation: 'archive',
                    habitId: 'habit-1',
                  },
                  {
                    entity: 'habit',
                    operation: 'archive',
                    habitId: 'habit-1',
                  },
                ],
              },
            }),
          },
        },
      ],
    });

    await expect(
      sendMessage({
        messages: [{ role: 'user', content: 'Archive that habit.' }],
        habits: [
          {
            id: 'habit-1',
            name: 'Take creatine',
            frequency: 'daily',
            active: true,
            createdAt: Date.now(),
          },
        ],
        goals: [],
        todos: [],
        journalEntries: [],
        dailyPlan: null,
        memories: [],
      })
    ).rejects.toThrow('proposal includes multiple changes for habit:habit-1');
  });

  it('rejects habit proposals that contradict the assistant message', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'I will go ahead and create a habit for taking creatine daily.',
              proposal: {
                actions: {
                  entity: 'habit',
                  operation: 'archive',
                  habitId: 'habit-1',
                },
              },
            }),
          },
        },
      ],
    });

    await expect(
      sendMessage({
        messages: [{ role: 'user', content: 'Can you add that habit?' }],
        habits: [
          {
            id: 'habit-1',
            name: 'Old habit',
            frequency: 'daily',
            active: true,
            createdAt: Date.now(),
          },
        ],
        goals: [],
        todos: [],
        journalEntries: [],
        dailyPlan: null,
        memories: [],
      })
    ).rejects.toThrow('assistant message describes creating a habit but proposal archives one');
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
