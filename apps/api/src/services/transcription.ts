import OpenAI from 'openai';
import { config } from '../config.js';

const client = new OpenAI({ apiKey: config.openai.apiKey });

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const extensionMap: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/webm': 'webm',
  };
  const extension = extensionMap[mimeType] || 'wav';

  // Convert Buffer to Uint8Array for compatibility with the File constructor.
  const file = new File([new Uint8Array(audioBuffer)], `audio.${extension}`, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });

  return response.text;
}
