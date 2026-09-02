import type { CoachStreamEvent, SpeakRequest } from '@habits-coach/shared';
import { Endpointer } from '../utils/endpointing';
import { VoiceController } from '../utils/liveVoice/controller';
import type { VoiceControllerDeps } from '../utils/liveVoice/types';

const QUIET = 0.15;
const SPEECH = 0.7;
const STEP_MS = 50;

type Listener = (event: never) => void;

/** The native module, as far as the controller can tell. */
function fakeAudio() {
  const listeners = new Map<string, Set<Listener>>();
  const calls: string[] = [];
  let utterances = 0;
  const audio: VoiceControllerDeps['audio'] = {
    start: jest.fn(async () => void calls.push('start')),
    stop: jest.fn(async () => void calls.push('stop')),
    setMuted: jest.fn((muted: boolean) => void calls.push(`setMuted:${muted}`)),
    beginUtterance: jest.fn(() => void calls.push('beginUtterance')),
    endUtterance: jest.fn(async () => {
      calls.push('endUtterance');
      utterances += 1;
      return `file:///tmp/utterance-${utterances}.wav`;
    }),
    cancelUtterance: jest.fn(() => void calls.push('cancelUtterance')),
    enqueueAudio: jest.fn(() => void calls.push('enqueueAudio')),
    finishPlayback: jest.fn(() => void calls.push('finishPlayback')),
    stopPlayback: jest.fn(() => void calls.push('stopPlayback')),
    addListener: jest.fn((name: string, listener: Listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(listener);
      return { remove: () => void listeners.get(name)!.delete(listener) };
    }) as VoiceControllerDeps['audio']['addListener'],
  };
  const emit = (name: string, payload?: unknown) => {
    listeners.get(name)?.forEach((listener) => (listener as (event: unknown) => void)(payload));
  };
  return { audio, calls, emit };
}

interface Turn {
  prompt: string;
  emit(event: CoachStreamEvent): void;
  finish(): void;
}

function setup(options: { transcribe?: (uri: string) => Promise<string> } = {}) {
  const { audio, calls, emit } = fakeAudio();
  const clock = { at: 0 };
  const transcript: string[] = [];
  const turns: Turn[] = [];
  const spoken: SpeakRequest[] = [];
  const assistant = new Map<string, string>();
  let nextId = 0;

  const deps: VoiceControllerDeps = {
    audio,
    transcribe: options.transcribe ?? (async () => 'I skipped the gym'),
    streamTurn: (prompt, onEvent) =>
      new Promise<void>((resolve) => {
        turns.push({ prompt, emit: onEvent, finish: resolve });
      }),
    recoverTurn: async () => null,
    fetchSpeech: async (request, onChunk) => {
      spoken.push(request);
      onChunk(new Uint8Array([1, 2]));
    },
    transcript: {
      addUser: async (text) => void transcript.push(`user: ${text}`),
      startAssistant: (delta) => {
        const id = `a${(nextId += 1)}`;
        assistant.set(id, delta);
        transcript.push(`assistant:${id}`);
        return id;
      },
      appendAssistant: (id, delta) => void assistant.set(id, (assistant.get(id) ?? '') + delta),
      finalizeAssistant: async (id, content) => void assistant.set(id, content),
      addAssistant: async (content) => void transcript.push(`assistant: ${content}`),
    },
    describeActivity: (tool) => `Doing ${tool}…`,
    explainTurnError: (error) => (error instanceof Error ? error.message : 'failed'),
    onTurnFinished: jest.fn(),
    now: () => clock.at,
    endpointer: new Endpointer({
      calibrationMs: 100,
      onsetMs: 100,
      earlyGraceMs: 300,
      lateGraceMs: 300,
      minUtteranceMs: 100,
    }),
  };
  const controller = new VoiceController(deps);

  /** Feeds `ms` of one level through the native level event. */
  const hear = (level: number, ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
      clock.at += STEP_MS;
      emit('onLevel', { level });
    }
  };
  const settle = async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const say = async (ms = 600) => {
    hear(SPEECH, ms);
    hear(QUIET, 400);
    await settle();
  };
  const playbackDone = async () => {
    emit('onPlaybackDone');
    await settle();
  };
  return { controller, deps, audio, calls, emit, hear, say, settle, playbackDone, transcript, turns, spoken, assistant };
}

async function started(options?: Parameters<typeof setup>[0]) {
  const world = setup(options);
  await world.controller.start();
  world.hear(QUIET, 200);
  return world;
}

describe('VoiceController', () => {
  it('listens once the engine is up', async () => {
    const { controller, audio } = await started();

    expect(audio.start).toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe('listening');
  });

  it('runs one turn: heard → transcribed → thinking → speaking → listening', async () => {
    const world = await started();
    const { controller, calls, turns } = world;

    await world.say();
    expect(calls).toContain('beginUtterance');
    expect(calls).toContain('endUtterance');
    expect(turns).toHaveLength(1);
    expect(turns[0].prompt).toBe('I skipped the gym');
    expect(controller.getSnapshot()).toMatchObject({ phase: 'thinking', userText: 'I skipped the gym' });
    expect(world.transcript).toEqual(['user: I skipped the gym']);

    turns[0].emit({ type: 'text', delta: 'That happens. ' });
    await world.settle();
    expect(controller.getSnapshot().phase).toBe('speaking');
    expect(world.spoken.map((request) => request.text)).toEqual(['That happens.']);

    turns[0].emit({ type: 'text', delta: 'What got in the way?' });
    turns[0].emit({ type: 'done', message: 'That happens. What got in the way?' });
    turns[0].finish();
    await world.settle();
    expect(world.spoken.map((request) => request.text)).toEqual(['That happens.', 'What got in the way?']);
    expect(world.spoken[1].previousText).toBe('That happens.');
    expect(calls).toContain('finishPlayback');
    expect(world.assistant.get('a1')).toBe('That happens. What got in the way?');

    await world.playbackDone();
    expect(controller.getSnapshot()).toMatchObject({ phase: 'listening', coachText: 'That happens. What got in the way?' });
    expect(world.deps.onTurnFinished).toHaveBeenCalledTimes(1);
  });

  it('speaks the activity line while thinking, never once the reply has begun', async () => {
    const world = await started();
    await world.say();

    world.turns[0].emit({ type: 'tool', name: 'list_tasks' });
    await world.settle();
    expect(world.controller.getSnapshot().activity).toBe('Doing list_tasks…');
    expect(world.spoken.map((request) => request.text)).toEqual(['Doing list_tasks…']);

    world.turns[0].emit({ type: 'text', delta: 'Right. ' });
    world.turns[0].emit({ type: 'tool', name: 'save_plan' });
    await world.settle();
    expect(world.spoken.map((request) => request.text)).toEqual(['Doing list_tasks…', 'Right.']);
  });

  it('barge-in silences the speaker, keeps the reply for the transcript, and asks the interruption next', async () => {
    const world = await started();
    const { controller, calls, turns } = world;
    await world.say();
    turns[0].emit({ type: 'text', delta: 'Let me walk you through the whole week. ' });
    await world.settle();
    expect(controller.getSnapshot().phase).toBe('speaking');

    calls.length = 0;
    await world.say(800);
    expect(calls[0]).toBe('stopPlayback');
    // The interruption is transcribed but waits for the turn it cut off.
    expect(controller.getSnapshot()).toMatchObject({ phase: 'transcribing', interrupted: true });
    expect(turns).toHaveLength(1);

    turns[0].emit({ type: 'text', delta: 'Monday first.' });
    turns[0].emit({ type: 'done', message: 'Let me walk you through the whole week. Monday first.' });
    turns[0].finish();
    await world.settle();
    expect(world.assistant.get('a1')).toBe('Let me walk you through the whole week. Monday first.');
    expect(calls.filter((call) => call === 'enqueueAudio')).toHaveLength(0);
    expect(calls).not.toContain('finishPlayback');

    expect(turns).toHaveLength(2);
    expect(controller.getSnapshot()).toMatchObject({ phase: 'thinking', interrupted: false });
    expect(world.transcript).toEqual(['user: I skipped the gym', 'assistant:a1', 'user: I skipped the gym']);
  });

  it('needs a louder voice to interrupt than to answer', async () => {
    const world = await started();
    await world.say();
    world.turns[0].emit({ type: 'text', delta: 'Here is a thought. ' });
    await world.settle();

    world.hear(0.15 + 0.16, 800);
    await world.settle();
    expect(world.controller.getSnapshot().phase).toBe('speaking');
    expect(world.audio.beginUtterance).toHaveBeenCalledTimes(1);
  });

  it('goes back to listening when nothing intelligible was said', async () => {
    const world = await started({ transcribe: async () => '   ' });

    await world.say();
    expect(world.turns).toHaveLength(0);
    expect(world.controller.getSnapshot()).toMatchObject({ phase: 'listening', notice: "I didn't catch that." });
  });

  it('muted: the mic is ignored and a half-captured utterance is dropped', async () => {
    const world = await started();
    world.hear(SPEECH, 300);
    expect(world.calls).toContain('beginUtterance');

    world.controller.toggleMute();
    expect(world.audio.setMuted).toHaveBeenLastCalledWith(true);
    expect(world.calls).toContain('cancelUtterance');

    world.hear(SPEECH, 1000);
    world.hear(QUIET, 600);
    await world.settle();
    expect(world.audio.endUtterance).not.toHaveBeenCalled();
    expect(world.controller.getSnapshot()).toMatchObject({ phase: 'listening', muted: true });
  });

  it('a stream error still lands in the transcript and is shown, not spoken', async () => {
    const world = await started();
    await world.say();
    world.turns[0].emit({ type: 'error', message: 'The coach ran out of time.' });
    world.turns[0].finish();
    await world.settle();

    expect(world.transcript).toContain('assistant: The coach ran out of time.');
    expect(world.spoken).toHaveLength(0);
    expect(world.controller.getSnapshot()).toMatchObject({ phase: 'listening', notice: 'The coach ran out of time.' });
  });

  it('an engine error ends the session and says why', async () => {
    const world = await started();
    world.emit('onError', { message: 'The call was interrupted by another app.' });

    expect(world.controller.getSnapshot()).toMatchObject({
      phase: 'error',
      error: 'The call was interrupted by another app.',
    });
    world.hear(SPEECH, 1000);
    expect(world.audio.beginUtterance).not.toHaveBeenCalled();
  });

  it('Done stops the engine and lets an in-flight turn finish silently', async () => {
    const world = await started();
    await world.say();

    await world.controller.stop();
    expect(world.audio.stop).toHaveBeenCalled();
    expect(world.controller.getSnapshot().phase).toBe('idle');

    world.turns[0].emit({ type: 'text', delta: 'Still here. ' });
    world.turns[0].emit({ type: 'done', message: 'Still here.' });
    world.turns[0].finish();
    await world.settle();
    expect(world.spoken).toHaveLength(0);
    expect(world.assistant.get('a1')).toBe('Still here.');
  });
});
