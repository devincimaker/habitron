import type { SpeakRequest } from '@habits-coach/shared';

/** What the queue needs from the speaker: the native module, or a test double. */
export interface SpeechPlayer {
  enqueueAudio(bytes: Uint8Array): void;
  finishPlayback(): void;
  stopPlayback(): void;
}

export type FetchSpeech = (
  request: SpeakRequest,
  onChunk: (bytes: Uint8Array) => void,
  signal: AbortSignal
) => Promise<void>;

export interface SpeechQueueOptions {
  player: SpeechPlayer;
  fetchSpeech: FetchSpeech;
  /** The first audio of the reply is on its way to the speaker. */
  onReplyStarted(): void;
  /** How many characters of the reply have been sent to be spoken so far. */
  onProgress(spokenChars: number): void;
  /** Everything the turn had to say has left the speaker. */
  onIdle(): void;
  /** A sentence could not be fetched. The queue moves on to the next one. */
  onError(error: unknown): void;
}

type SpeechKind = 'reply' | 'aside';

interface SpeechItem {
  text: string;
  kind: SpeechKind;
}

/**
 * Speaks one turn of the coach: reply sentences in order, each fetched with
 * its neighbours as context so the voice carries across the seams, and
 * activity lines ("Looking at your tasks…") as asides while the reply has
 * not started. Fetches run one at a time — the speaker plays in order and a
 * sentence fetched early is a sentence held in memory for nothing.
 */
export class SpeechQueue {
  private readonly options: SpeechQueueOptions;
  private items: SpeechItem[] = [];
  private current: SpeechItem | null = null;
  private controller: AbortController | null = null;
  private lastReply: string | null = null;
  private spokenChars = 0;
  private replyStarted = false;
  private ended = false;
  /** Audio has been handed to the speaker and has not been reported played. */
  private playing = false;

  constructor(options: SpeechQueueOptions) {
    this.options = options;
  }

  /** True from the first queued sentence until the speaker has gone quiet. */
  get isActive(): boolean {
    return this.playing || this.current !== null || this.items.length > 0;
  }

  /** Drops whatever the previous turn left and starts counting afresh. */
  beginTurn(): void {
    this.cancel();
    this.lastReply = null;
    this.spokenChars = 0;
    this.replyStarted = false;
  }

  say(text: string, kind: SpeechKind): void {
    if (kind === 'aside') {
      // An aside fills the wait for the reply; once the reply is here it is noise.
      const replyUnderway =
        this.replyStarted || this.current?.kind === 'reply' || this.items.some((item) => item.kind === 'reply');
      if (replyUnderway || this.ended) return;
    } else {
      this.items = this.items.filter((item) => item.kind === 'reply');
    }
    this.items.push({ text, kind });
    this.pump();
  }

  /** The reply is complete: `onIdle` follows once the last sentence has played. */
  end(): void {
    this.ended = true;
    this.pump();
  }

  /** Silence, now: a barge-in, or the session ending. */
  cancel(): void {
    this.items = [];
    this.ended = false;
    this.current = null;
    this.controller?.abort();
    this.controller = null;
    this.options.player.stopPlayback();
    this.playing = false;
  }

  /** From the speaker: every chunk since the last `finishPlayback` has played. */
  handlePlaybackDone(): void {
    this.playing = false;
    this.settleIfDone();
  }

  private settleIfDone(): void {
    if (!this.ended || this.current || this.items.length > 0) return;
    if (this.playing) {
      this.options.player.finishPlayback();
      return;
    }
    this.ended = false;
    this.options.onIdle();
  }

  private pump(): void {
    if (this.current) return;
    const next = this.items.shift();
    if (!next) {
      this.settleIfDone();
      return;
    }

    this.current = next;
    const controller = new AbortController();
    this.controller = controller;
    let drained = false;

    const request: SpeakRequest = { text: next.text };
    if (next.kind === 'reply') {
      if (this.lastReply) request.previousText = this.lastReply;
      const following = this.items.find((item) => item.kind === 'reply');
      if (following) request.nextText = following.text;
      this.spokenChars += next.text.length;
      this.options.onProgress(this.spokenChars);
    }

    void this.options
      .fetchSpeech(
        request,
        (bytes) => {
          if (controller.signal.aborted) return;
          this.playing = true;
          this.options.player.enqueueAudio(bytes);
          if (next.kind === 'reply' && !this.replyStarted) {
            this.replyStarted = true;
            this.options.onReplyStarted();
          }
        },
        controller.signal
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) this.options.onError(error);
      })
      .finally(() => {
        if (this.controller !== controller || drained) return;
        drained = true;
        this.controller = null;
        this.current = null;
        if (next.kind === 'reply') this.lastReply = next.text;
        this.pump();
      });
  }
}
