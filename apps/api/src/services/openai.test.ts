import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a hoisted mock reference
const mockTranscriptionsCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
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

import { transcribeAudio } from './openai.js';

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
