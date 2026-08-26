import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from './supabase';
import type { CoachInstructRequest, CoachStreamEvent, CoachTurnRequest } from '@habits-coach/shared';
import { createApiUrl } from './apiUrl';
import { createSseParser } from '../utils/sse';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError('Not authenticated', 401);
  }

  return session.access_token;
}

/**
 * One coach turn over server-sent events. Events arrive as the coach works
 * (text deltas, tool activity) and the turn ends with `done` or `error`; the
 * promise resolves once the stream closes.
 */
async function streamEvents(
  path: string,
  request: unknown,
  onEvent: (event: CoachStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = await getAuthToken();

  const response = await streamingFetch(createApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.error || 'Failed to send message', response.status);
  }

  if (!response.body) {
    throw new ApiError('The coach response had no body', response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const feed = createSseParser(onEvent);
  // An abort mid-stream has to reach the reader too, or the loop below waits
  // on a chunk that is never coming. The listener dies with the turn's controller.
  // A stream that already errored rejects on cancel; an abort is not a place
  // to raise that again.
  signal?.addEventListener('abort', () => void reader.cancel().catch(() => {}), { once: true });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    feed(decoder.decode(value, { stream: true }));
  }
  feed(decoder.decode());
}

/** One turn of a coaching session. */
export function streamCoachTurn(
  request: CoachTurnRequest,
  onEvent: (event: CoachStreamEvent) => void
): Promise<void> {
  return streamEvents('/api/chat', request, onEvent);
}

/** One hold-to-instruct turn: propose, correct, or apply. No coaching session involved. */
export function streamInstructTurn(
  request: CoachInstructRequest,
  onEvent: (event: CoachStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return streamEvents('/api/instruct', request, onEvent, signal);
}

export async function transcribeAudio(audioUri: string, signal?: AbortSignal): Promise<string> {
  const token = await getAuthToken();

  // Create form data with the audio file
  const formData = new FormData();

  // Get the file extension from URI and determine mime type
  const extension = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeTypeMap: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/x-m4a',
    mp4: 'audio/mp4',
    webm: 'audio/webm',
  };
  const mimeType = mimeTypeMap[extension] || 'audio/x-m4a';

  formData.append('audio', {
    uri: audioUri,
    type: mimeType,
    name: `recording.${extension}`,
  } as unknown as Blob);

  const response = await fetch(createApiUrl('/api/transcribe'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to transcribe audio');
  }

  const data = await response.json();
  return data.text;
}

/**
 * Notify the backend when a user skips a habit.
 * This is used to detect first-ever skip and schedule a notification.
 * Fire-and-forget - errors are logged but not thrown.
 */
export async function notifyFirstSkip(habitId: string): Promise<void> {
  try {
    const token = await getAuthToken();

    const response = await fetch(createApiUrl('/api/notifications/first-skip'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ habitId }),
    });

    if (!response.ok) {
      console.error('Failed to notify first skip:', response.status);
    }
  } catch (error) {
    // Fire and forget - don't throw, just log
    console.error('Error notifying first skip:', error);
  }
}
