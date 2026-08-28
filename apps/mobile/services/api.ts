import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from './supabase';
import type { CoachInstructRequest, CoachStreamEvent, CoachTurnRequest } from '@habits-coach/shared';
import { createApiUrl } from './apiUrl';
import { CoachStreamDroppedError, createSseParser } from '../utils/sse';

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
  let turnEnded = false;
  const feed = createSseParser((event) => {
    if (event.type === 'done' || event.type === 'error') turnEnded = true;
    onEvent(event);
  });
  // An abort mid-stream has to reach the reader too, or the loop below waits
  // on a chunk that is never coming. The listener dies with the turn's controller.
  // A stream that already errored rejects on cancel; an abort is not a place
  // to raise that again.
  signal?.addEventListener('abort', () => void reader.cancel().catch(() => {}), { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      feed(decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CoachStreamDroppedError(error);
  }
  feed(decoder.decode());

  // The stream can also end without the turn ending — a rolled container, a
  // proxy closing an idle response. Silence is not a reply: that is a drop too.
  if (!turnEnded && !signal?.aborted) {
    throw new CoachStreamDroppedError(new Error('The coach stream closed before the turn ended'));
  }
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

/**
 * The deadline covers the whole call, and most of that is the upload, not
 * Whisper: a four-minute recording is the longest the recorder allows
 * (`useAudioRecorder.ts:13`) and lands around 4 MB, which needs well over a
 * minute on a weak uplink. Whisper's own share is seconds.
 *
 * So this is sized for the worst upload that should still succeed rather than
 * for server think time — a tighter bound would fail long recordings on bad
 * connections that used to work, and the retry would re-upload the same file
 * into the same deadline and fail again. Three minutes is still a bound where
 * there was none.
 */
const TRANSCRIBE_TIMEOUT_MS = 180_000;

/**
 * A signal that aborts after `ms`, or as soon as `caller` does.
 *
 * `AbortSignal.timeout` and `AbortSignal.any` would say this in two lines, but
 * neither is guaranteed on Hermes, and a `TypeError` would land on exactly the
 * path this deadline exists to rescue. `AbortController` is already proven in
 * this app — InstructProvider builds one per turn.
 *
 * `release()` is not optional: a pending timer holds its callback alive, and a
 * listener left on the caller's signal outlives the request it belonged to.
 */
/**
 * Settles with `work`, or rejects as soon as `signal` aborts. The work itself
 * carries on — `getAuthToken` takes no signal — but the caller stops waiting.
 */
function raceSignal<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) => {
      const fail = () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal.aborted) fail();
      else signal.addEventListener('abort', fail, { once: true });
    }),
  ]);
}

function withDeadline(ms: number, caller?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);

  const forward = () => controller.abort();
  if (caller?.aborted) controller.abort();
  else caller?.addEventListener('abort', forward);

  return {
    signal: controller.signal,
    /** True only when the deadline fired — a caller's own abort is not a timeout. */
    get timedOut() {
      return timedOut;
    },
    release() {
      clearTimeout(timer);
      caller?.removeEventListener('abort', forward);
    },
  };
}

export class TranscriptionTimeoutError extends Error {
  constructor(cause?: unknown) {
    super('Transcription timed out. Check your connection and try again.', { cause });
    this.name = 'TranscriptionTimeoutError';
  }
}

export async function transcribeAudio(audioUri: string, signal?: AbortSignal): Promise<string> {
  // Armed before the token, not after: refreshing a JWT is itself a network
  // call, and a hang there is the same failure this deadline exists to bound.
  const deadline = withDeadline(TRANSCRIBE_TIMEOUT_MS, signal);

  try {
    return await transcribeWithin(audioUri, deadline.signal);
  } catch (error) {
    // The pill and the Instruct notice both show this message, and "Aborted"
    // would read as though the user had cancelled something they never touched.
    if (deadline.timedOut) throw new TranscriptionTimeoutError(error);
    throw error;
  } finally {
    deadline.release();
  }
}

async function transcribeWithin(audioUri: string, signal: AbortSignal): Promise<string> {
  const token = await raceSignal(getAuthToken(), signal);

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

  // A server that accepts the connection and never answers is indistinguishable
  // from a slow one, and NSURLSession's own request timeout does not fire on it.
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
