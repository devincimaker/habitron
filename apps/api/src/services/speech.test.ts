import { describe, it, expect, vi, afterEach } from 'vitest';
import { synthesizeSpeech } from './speech.js';

describe('synthesizeSpeech', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks ElevenLabs for streamed PCM with the neighbouring sentences for stitching', async () => {
    const body = new ReadableStream<Uint8Array>();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body });
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizeSpeech({
      text: 'Shall we move the two smaller tasks?',
      previousText: "Thursday's the real weight here.",
    });

    expect(result).toBe(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/text-to-speech/');
    expect(url).toContain('output_format=pcm_24000');
    expect(init.headers['xi-api-key']).toBe('test-elevenlabs-key');
    expect(JSON.parse(init.body)).toMatchObject({
      text: 'Shall we move the two smaller tasks?',
      model_id: 'eleven_flash_v2_5',
      previous_text: "Thursday's the real weight here.",
    });
  });

  it('turns a provider error into a thrown error with the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota exceeded' })
    );

    await expect(synthesizeSpeech({ text: 'Hello.' })).rejects.toThrow(
      'ElevenLabs returned 429: quota exceeded'
    );
  });
});
