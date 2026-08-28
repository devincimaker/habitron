jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

let getSession = async () => ({ data: { session: { access_token: 'token' } } });

jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
  },
}));

jest.mock('../services/apiUrl', () => ({
  createApiUrl: (path: string) => `http://api.test${path}`,
}));

import { TranscriptionTimeoutError, transcribeAudio } from '../services/api';

/**
 * The measured failure: a server that accepts the connection and never answers.
 * `fetch` resolves only when its signal aborts, which is what the deadline has
 * to do on its own — NSURLSession's request timeout does not fire on this.
 */
function silentServer() {
  const calls: { signal?: AbortSignal }[] = [];

  const abortError = () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
  };

  const mocked = jest.fn((_url: string, init: { signal?: AbortSignal }) => {
    calls.push(init);
    // A real fetch rejects straight away on a signal that is already aborted,
    // rather than waiting for an event that has been and gone.
    if (init.signal?.aborted) return Promise.reject(abortError());
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(abortError()));
    });
  });
  globalThis.fetch = mocked as unknown as typeof globalThis.fetch;

  return { calls };
}

describe('transcribeAudio', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getSession = async () => ({ data: { session: { access_token: 'token' } } });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('rejects on its own once the deadline passes', async () => {
    silentServer();

    const pending = transcribeAudio('file:///recording.m4a');
    const settled = expect(pending).rejects.toThrow(TranscriptionTimeoutError);

    // Let getAuthToken's await resolve so the request is actually in flight.
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(180_000);

    await settled;
  });

  it('does not reject before the deadline', async () => {
    silentServer();

    let settled = false;
    const pending = transcribeAudio('file:///recording.m4a').catch(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(179_000);
    await Promise.resolve();

    expect(settled).toBe(false);

    jest.advanceTimersByTime(1_000);
    await pending;
    expect(settled).toBe(true);
  });

  // InstructProvider passes its turn's signal; aborting a turn must still read
  // as a cancellation, not as "the server timed out".
  it("forwards a caller's abort without calling it a timeout", async () => {
    silentServer();
    const caller = new AbortController();

    const pending = transcribeAudio('file:///recording.m4a', caller.signal);
    const settled = expect(pending).rejects.toThrow(/Aborted/);

    await Promise.resolve();
    await Promise.resolve();
    caller.abort();

    await settled;
  });

  it('aborts immediately when the caller was already aborted', async () => {
    silentServer();
    const caller = new AbortController();
    caller.abort();

    await expect(
      transcribeAudio('file:///recording.m4a', caller.signal)
    ).rejects.toThrow(/Aborted/);
  });

  // A pending three-minute timer holds its callback alive, so a request that
  // answers must clear it rather than leave one armed per transcription.
  it('clears the deadline once the request answers', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ text: 'hello there' }),
    })) as unknown as typeof globalThis.fetch;

    await expect(transcribeAudio('file:///recording.m4a')).resolves.toBe('hello there');
    expect(jest.getTimerCount()).toBe(0);
  });

  // Refreshing a JWT is a network call of its own, so a hang there is the same
  // failure as a hung upload — and it used to sit outside the deadline entirely.
  it('bounds a hung token refresh too', async () => {
    silentServer();
    getSession = () => new Promise(() => {}) as ReturnType<typeof getSession>;

    const pending = transcribeAudio('file:///recording.m4a');
    const settled = expect(pending).rejects.toThrow(TranscriptionTimeoutError);

    await Promise.resolve();
    jest.advanceTimersByTime(180_000);

    await settled;
  });
});
