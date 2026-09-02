import { fetch as streamingFetch } from 'expo/fetch';
import type { SpeakRequest } from '@habits-coach/shared';
import { supabase } from './supabase';
import { createApiUrl } from './apiUrl';

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

/**
 * One sentence of the coach's voice from POST /api/speak, streamed as raw
 * int16 LE 24 kHz mono PCM. Chunks reach `onChunk` as they arrive, so the
 * first one is playing before the last is synthesised; the promise resolves
 * when the sentence is complete or rejects when the server would not speak.
 */
export async function streamSpeech(
  request: SpeakRequest,
  onChunk: (bytes: Uint8Array) => void,
  signal: AbortSignal
): Promise<void> {
  const token = await getAuthToken();

  const response = await streamingFetch(createApiUrl('/api/speak'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Speech is unavailable right now.');
  }
  if (!response.body) throw new Error('The speech response had no body');

  // The abort reaches the request itself (it was passed to fetch), and
  // expo/fetch closes the body stream when the request ends. Cancelling the
  // reader here as well makes that close throw inside expo's own listener.
  const reader = response.body.getReader();
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) onChunk(value);
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}
