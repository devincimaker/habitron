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
