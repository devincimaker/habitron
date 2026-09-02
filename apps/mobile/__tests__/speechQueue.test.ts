import type { SpeakRequest } from '@habits-coach/shared';
import { SpeechQueue } from '../utils/liveVoice/speechQueue';

interface Pending {
  request: SpeakRequest;
  onChunk(bytes: Uint8Array): void;
  signal: AbortSignal;
  resolve(): void;
  reject(error: Error): void;
}

function setup() {
  const pending: Pending[] = [];
  const player = {
    enqueueAudio: jest.fn(),
    finishPlayback: jest.fn(),
    stopPlayback: jest.fn(),
  };
  const events = {
    onReplyStarted: jest.fn(),
    onProgress: jest.fn(),
    onIdle: jest.fn(),
    onError: jest.fn(),
  };
  const queue = new SpeechQueue({
    player,
    fetchSpeech: (request, onChunk, signal) =>
      new Promise<void>((resolve, reject) => {
        pending.push({ request, onChunk, signal, resolve, reject });
      }),
    ...events,
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const complete = async (index: number) => {
    pending[index].onChunk(new Uint8Array(2));
    pending[index].resolve();
    await settle();
  };
  return { queue, player, events, pending, settle, complete };
}

describe('SpeechQueue', () => {
  it('fetches sentences one at a time, each with its neighbours for context', async () => {
    const { queue, pending, complete, events } = setup();
    queue.beginTurn();
    queue.say('First.', 'reply');
    queue.say('Second.', 'reply');
    queue.say('Third.', 'reply');

    // The first sentence goes out before the second exists: no nextText to give.
    expect(pending).toHaveLength(1);
    expect(pending[0].request).toEqual({ text: 'First.' });

    await complete(0);
    expect(events.onReplyStarted).toHaveBeenCalledTimes(1);
    expect(pending[1].request).toEqual({ text: 'Second.', previousText: 'First.', nextText: 'Third.' });
    expect(events.onProgress).toHaveBeenLastCalledWith('First.'.length + 'Second.'.length);
  });

  it('asks the speaker to drain once the last sentence is in, then reports idle', async () => {
    const { queue, player, events, complete } = setup();
    queue.beginTurn();
    queue.say('Only one.', 'reply');
    queue.end();
    expect(player.finishPlayback).not.toHaveBeenCalled();

    await complete(0);
    expect(player.finishPlayback).toHaveBeenCalledTimes(1);
    expect(events.onIdle).not.toHaveBeenCalled();

    queue.handlePlaybackDone();
    expect(events.onIdle).toHaveBeenCalledTimes(1);
  });

  it('is idle at once when the turn had nothing to say', () => {
    const { queue, player, events } = setup();
    queue.beginTurn();
    queue.end();

    expect(player.finishPlayback).not.toHaveBeenCalled();
    expect(events.onIdle).toHaveBeenCalledTimes(1);
  });

  it('drops an aside the moment the reply is here', async () => {
    const { queue, pending, complete } = setup();
    queue.beginTurn();
    queue.say('Looking at your tasks…', 'aside');
    queue.say('Reading your day…', 'aside');
    queue.say('Here goes.', 'reply');
    queue.say('Too late.', 'aside');

    expect(pending.map((item) => item.request.text)).toEqual(['Looking at your tasks…']);
    await complete(0);
    expect(pending.map((item) => item.request.text)).toEqual(['Looking at your tasks…', 'Here goes.']);
  });

  it('cancel aborts the fetch, stops the speaker, and ignores late chunks', async () => {
    const { queue, player, pending, events, settle } = setup();
    queue.beginTurn();
    queue.say('A long sentence.', 'reply');
    queue.say('Another.', 'reply');

    queue.cancel();
    expect(pending[0].signal.aborted).toBe(true);
    expect(player.stopPlayback).toHaveBeenCalled();
    expect(queue.isActive).toBe(false);

    pending[0].onChunk(new Uint8Array(2));
    pending[0].reject(new Error('aborted'));
    await settle();
    expect(player.enqueueAudio).not.toHaveBeenCalled();
    expect(events.onError).not.toHaveBeenCalled();
    expect(pending).toHaveLength(1);
  });

  it('a failed sentence is reported and the next one still plays', async () => {
    const { queue, pending, events, settle, complete } = setup();
    queue.beginTurn();
    queue.say('Broken.', 'reply');
    queue.say('Fine.', 'reply');

    pending[0].reject(new Error('502'));
    await settle();
    expect(events.onError).toHaveBeenCalledTimes(1);
    expect(pending[1].request.text).toBe('Fine.');
    await complete(1);
    expect(events.onReplyStarted).toHaveBeenCalledTimes(1);
  });
});
