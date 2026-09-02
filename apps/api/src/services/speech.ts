import { config } from '../config.js';
import type { SpeakRequest } from '@habits-coach/shared';

/**
 * What comes back: raw signed 16-bit little-endian mono PCM at this rate. The
 * app's player node schedules it straight into `AVAudioEngine`; a compressed
 * format would need a decoder that can take arbitrary chunk boundaries.
 */
export const SPEECH_SAMPLE_RATE = 24_000;
export const SPEECH_MIME_TYPE = 'audio/pcm';

/** Flash: the low-latency model, which is what a spoken turn needs first. */
const MODEL_ID = 'eleven_flash_v2_5';

/**
 * One sentence to speech, streamed as it is synthesised. `previousText` and
 * `nextText` are how ElevenLabs joins per-sentence requests without the
 * prosody reset that isolated requests give: the seam is inaudible when the
 * voice knows what came before and what comes next.
 */
export async function synthesizeSpeech(
  request: SpeakRequest,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}/stream` +
    `?output_format=pcm_${SPEECH_SAMPLE_RATE}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': config.elevenlabs.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: request.text,
      model_id: MODEL_ID,
      previous_text: request.previousText,
      next_text: request.nextText,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `ElevenLabs returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  if (!response.body) {
    throw new Error('ElevenLabs returned no audio');
  }
  return response.body;
}
