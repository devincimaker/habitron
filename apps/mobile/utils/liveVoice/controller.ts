import { Endpointer } from '../endpointing';
import { createSentenceChunker } from '../speechChunker';
import { CoachStreamDroppedError } from '../sse';
import { SpeechQueue } from './speechQueue';
import type { VoiceControllerDeps, VoiceSnapshot } from './types';

export type { VoicePhase, VoiceSnapshot } from './types';

const INITIAL: VoiceSnapshot = {
  phase: 'idle',
  muted: false,
  interrupted: false,
  userText: null,
  coachText: '',
  spokenChars: 0,
  activity: null,
  notice: null,
  error: null,
};

const NOTHING_HEARD = "I didn't catch that.";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The state machine of interactive mode: idle → listening → transcribing →
 * thinking → speaking → listening, with a barge-in from thinking or speaking
 * back to listening. Turns run to completion server-side whatever happens
 * here, so an interruption only silences the speaker: the full reply still
 * lands in the transcript, and what the user said becomes the next prompt.
 */
export class VoiceController {
  private readonly deps: VoiceControllerDeps;
  private readonly now: () => number;
  private readonly endpointer: Endpointer;
  private readonly queue: SpeechQueue;
  private snapshot: VoiceSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private readonly levelListeners = new Set<(level: number) => void>();
  private subscriptions: { remove(): void }[] = [];
  private stopped = true;
  private capturing = false;
  private turn: { suppressed: boolean } | null = null;
  private turnChain: Promise<void> = Promise.resolve();
  private queuedTurns = 0;

  constructor(deps: VoiceControllerDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
    this.endpointer = deps.endpointer ?? new Endpointer();
    this.queue = new SpeechQueue({
      player: deps.audio,
      fetchSpeech: deps.fetchSpeech,
      onReplyStarted: () => {
        // Thinking is the only phase a reply's audio can start from: a barge-in
        // has already moved to listening, and a stopped queue enqueues nothing.
        if (this.snapshot.phase === 'thinking') this.patch({ phase: 'speaking', activity: null });
      },
      onProgress: (spokenChars) => this.patch({ spokenChars }),
      onIdle: () => {
        if (!this.stopped && !this.turn && this.queuedTurns === 0) this.patch({ phase: 'listening' });
      },
      onError: () => this.patch({ notice: "The coach's voice dropped out. The words are in the transcript." }),
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): VoiceSnapshot => this.snapshot;

  /** Mic levels, ~12 a second: for the orb, kept out of React state on purpose. */
  subscribeLevel = (listener: (level: number) => void): (() => void) => {
    this.levelListeners.add(listener);
    return () => this.levelListeners.delete(listener);
  };

  async start(): Promise<void> {
    if (this.snapshot.phase !== 'idle' && this.snapshot.phase !== 'error') return;
    this.stopped = false;
    this.patch({ phase: 'starting', error: null, notice: null, interrupted: false });
    try {
      await this.deps.audio.start();
    } catch (error) {
      this.stopped = true;
      this.patch({ phase: 'error', error: messageOf(error, 'The microphone could not be started.') });
      return;
    }
    this.subscriptions = [
      this.deps.audio.addListener('onLevel', ({ level }) => this.handleLevel(level)),
      this.deps.audio.addListener('onPlaybackDone', () => this.queue.handlePlaybackDone()),
      this.deps.audio.addListener('onError', ({ message }) => this.handleAudioError(message)),
    ];
    this.endpointer.reset();
    this.deps.audio.setMuted(this.snapshot.muted);
    this.patch({ phase: 'listening' });
  }

  async stop(): Promise<void> {
    if (this.stopped && this.snapshot.phase === 'idle') return;
    this.stopped = true;
    this.silence();
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    await this.deps.audio.stop();
    this.patch({ phase: 'idle', activity: null });
  }

  toggleMute(): void {
    const muted = !this.snapshot.muted;
    this.deps.audio.setMuted(muted);
    if (muted && this.capturing) {
      this.capturing = false;
      this.deps.audio.cancelUtterance();
    }
    this.endpointer.reset({ keepFloor: true });
    this.patch({ muted });
  }

  private patch(changes: Partial<VoiceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    this.listeners.forEach((listener) => listener());
  }

  /** Stops the speaker and lets the in-flight turn finish silently. */
  private silence(): void {
    this.queue.cancel();
    if (this.turn) this.turn.suppressed = true;
    if (this.capturing) {
      this.capturing = false;
      this.deps.audio.cancelUtterance();
    }
  }

  private handleAudioError(message: string): void {
    this.stopped = true;
    this.silence();
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    this.patch({ phase: 'error', error: message, activity: null });
  }

  private handleLevel(level: number): void {
    if (this.stopped) return;
    this.levelListeners.forEach((listener) => listener(level));
    const { phase, muted } = this.snapshot;
    if (muted || phase === 'starting' || phase === 'idle' || phase === 'error') return;

    this.endpointer.setMode(this.queue.isActive ? 'bargeIn' : 'listen');
    const event = this.endpointer.push(level, this.now());
    if (!event) return;
    if (event.type === 'start') this.handleSpeechStart();
    else if (event.type === 'end') void this.handleSpeechEnd();
    else this.discardUtterance();
  }

  private handleSpeechStart(): void {
    if (this.queue.isActive) {
      // Barge-in: the speaker stops now; the turn finishes on the server and
      // in the transcript, unheard.
      this.queue.cancel();
      if (this.turn) this.turn.suppressed = true;
      this.patch({ phase: 'listening', interrupted: true, activity: null });
    }
    try {
      this.deps.audio.beginUtterance();
      this.capturing = true;
    } catch (error) {
      this.patch({ notice: messageOf(error, 'The microphone stopped recording.') });
    }
  }

  private discardUtterance(): void {
    if (!this.capturing) return;
    this.capturing = false;
    this.deps.audio.cancelUtterance();
  }

  private async handleSpeechEnd(): Promise<void> {
    if (!this.capturing) return;
    this.capturing = false;
    const uri = await this.deps.audio.endUtterance();
    if (!uri || this.stopped) return;

    const wasListening = this.snapshot.phase === 'listening';
    if (wasListening) this.patch({ phase: 'transcribing', notice: null });
    try {
      const text = (await this.deps.transcribe(uri)).trim();
      if (this.stopped) return;
      if (!text) {
        if (this.snapshot.phase === 'transcribing') this.patch({ phase: 'listening', notice: NOTHING_HEARD });
        return;
      }
      this.patch({ userText: text });
      this.enqueueTurn(text);
    } catch (error) {
      if (this.snapshot.phase === 'transcribing') this.patch({ phase: 'listening' });
      this.patch({ notice: messageOf(error, NOTHING_HEARD) });
    }
  }

  /** Turns run one after another: an interruption waits for the turn it cut off. */
  private enqueueTurn(prompt: string): void {
    this.queuedTurns += 1;
    this.turnChain = this.turnChain.then(() => {
      this.queuedTurns -= 1;
      return this.stopped ? undefined : this.runTurn(prompt);
    });
  }

  private async runTurn(prompt: string): Promise<void> {
    const turn = { suppressed: false };
    this.turn = turn;
    this.patch({
      phase: 'thinking',
      interrupted: false,
      activity: null,
      coachText: '',
      spokenChars: 0,
      userText: prompt,
      notice: null,
    });
    this.queue.beginTurn();
    const chunker = createSentenceChunker();
    const speak = (text: string) => {
      if (turn.suppressed || this.stopped) return;
      for (const sentence of chunker.push(text)) this.queue.say(sentence, 'reply');
    };

    let messageId: string | null = null;
    let streamed = '';
    let finalMessage: string | null = null;
    let errorMessage: string | null = null;

    try {
      await this.deps.transcript.addUser(prompt);
      try {
        await this.deps.streamTurn(prompt, (event) => {
          switch (event.type) {
            case 'text':
              streamed += event.delta;
              if (messageId) this.deps.transcript.appendAssistant(messageId, event.delta);
              else messageId = this.deps.transcript.startAssistant(event.delta);
              this.patch({ coachText: streamed, activity: null });
              speak(event.delta);
              break;
            case 'tool': {
              const activity = this.deps.describeActivity(event.name);
              this.patch({ activity });
              if (!turn.suppressed && this.snapshot.phase === 'thinking') this.queue.say(activity, 'aside');
              break;
            }
            case 'done':
              finalMessage = event.message;
              break;
            case 'error':
              errorMessage = event.message;
              break;
            case 'session':
              break;
          }
        });
      } catch (error) {
        const recovered =
          error instanceof CoachStreamDroppedError ? await this.deps.recoverTurn(prompt) : null;
        if (recovered?.status === 'done') finalMessage = recovered.reply;
        else if (recovered) errorMessage = recovered.error;
        else errorMessage = this.deps.explainTurnError(error);
      }

      const reply = finalMessage ?? streamed;
      let content = reply;
      if (errorMessage) content = content ? `${content}\n\n${errorMessage}` : errorMessage;
      if (messageId) await this.deps.transcript.finalizeAssistant(messageId, content);
      else if (content) await this.deps.transcript.addAssistant(content);

      // A reply that arrived whole (recovered, not streamed) has not been spoken yet.
      if (!streamed && finalMessage) speak(finalMessage);
      const rest = chunker.flush();
      if (rest && !turn.suppressed && !this.stopped) this.queue.say(rest, 'reply');
      this.patch({ coachText: reply, notice: errorMessage });
    } catch (error) {
      this.patch({ notice: this.deps.explainTurnError(error) });
    } finally {
      this.turn = null;
      this.patch({ activity: null });
      if (!turn.suppressed && !this.stopped) this.queue.end();
      else if (!this.stopped && this.queuedTurns === 0 && this.snapshot.phase === 'thinking') {
        this.patch({ phase: 'listening' });
      }
      this.deps.onTurnFinished();
    }
  }
}
