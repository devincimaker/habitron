import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from './supabase';
import type { CoachStreamEvent, CoachTurnRequest, InstructActionRow } from '@habits-coach/shared';
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

/** The server heard silence: nothing intelligible to enqueue. */
export class NothingHeardError extends Error {
  constructor() {
    super('Nothing heard');
    this.name = 'NothingHeardError';
  }
}

export type InstructVerb = 'retry' | 'cancel' | 'dismiss' | 'rewind' | 'restore';

/**
 * Fire-and-forget hold-to-instruct: upload the recording (or text), get the
 * queued row back. The same deadline as transcription — the server runs
 * Whisper inside this call — and after it resolves, everything is server state.
 */
export async function enqueueInstruction(
  input: { audioUri?: string; text?: string; reinstructOf?: string },
  signal?: AbortSignal
): Promise<InstructActionRow> {
  const deadline = withDeadline(TRANSCRIBE_TIMEOUT_MS, signal);
  try {
    const token = await raceSignal(getAuthToken(), deadline.signal);

    const formData = new FormData();
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (input.text) formData.append('text', input.text);
    if (input.reinstructOf) formData.append('reinstructOf', input.reinstructOf);
    if (input.audioUri) formData.append('audio', audioFormPart(input.audioUri));

    const response = await fetch(createApiUrl('/api/instruct/enqueue'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: deadline.signal,
    });

    if (response.status === 422) throw new NothingHeardError();
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to send the instruction');
    }
    const data = await response.json();
    return data.action as InstructActionRow;
  } catch (error) {
    if (deadline.timedOut) throw new TranscriptionTimeoutError(error);
    throw error;
  } finally {
    deadline.release();
  }
}

/** The activity log: the rows the pill, the sheet, and the hub count derive from. */
export async function fetchInstructLog(since?: string): Promise<InstructActionRow[]> {
  const token = await getAuthToken();
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const response = await fetch(createApiUrl(`/api/instruct/log${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to read the activity log');
  }
  const data = await response.json();
  return data.actions as InstructActionRow[];
}

/** One row action: retry, cancel, dismiss, rewind, or restore. */
export async function postInstructAction(id: string, verb: InstructVerb): Promise<InstructActionRow> {
  const token = await getAuthToken();
  const response = await fetch(createApiUrl(`/api/instruct/${id}/${verb}`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to ${verb}`);
  }
  const data = await response.json();
  return data.action as InstructActionRow;
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

/** A recording as a multipart part: uri + mime type inferred from the extension. */
function audioFormPart(audioUri: string): Blob {
  const extension = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeTypeMap: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/x-m4a',
    mp4: 'audio/mp4',
    webm: 'audio/webm',
  };
  const mimeType = mimeTypeMap[extension] || 'audio/x-m4a';

  return {
    uri: audioUri,
    type: mimeType,
    name: `recording.${extension}`,
  } as unknown as Blob;
}

async function transcribeWithin(audioUri: string, signal: AbortSignal): Promise<string> {
  const token = await raceSignal(getAuthToken(), signal);

  const formData = new FormData();
  formData.append('audio', audioFormPart(audioUri));

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
