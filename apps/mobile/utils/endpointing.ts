/**
 * Turn-taking from a level stream: decides when an utterance starts and when
 * it has ended, with nothing but the microphone's 0–1 level (the same
 * normalisation the recorder's meter uses: (dB + 60) / 60). There is no
 * streaming ASR in this pipeline, so this is the only endpointer there is.
 *
 * Free of React and of the native module on purpose: every threshold here is
 * a tuning decision, and tuning decisions need tests.
 */

export interface EndpointerConfig {
  /** How long to listen before trusting the noise floor. */
  calibrationMs: number;
  /** How far above the floor counts as speech while the coach is quiet. */
  listenMargin: number;
  /**
   * How far above the floor counts as speech while the coach is talking.
   * Higher on purpose: echo cancellation attenuates the coach's own voice, it
   * does not remove it.
   */
  bargeInMargin: number;
  /** Above the threshold for this long before an utterance opens: a door is shorter. */
  onsetMs: number;
  /**
   * Trailing silence that ends an utterance early on. Long enough that "I've
   * been feeling… (thinks) …flat about the gym" stays one thought.
   */
  earlyGraceMs: number;
  /** Trailing silence that ends an utterance once speech has been sustained. */
  lateGraceMs: number;
  /** Voiced time after which the shorter grace applies. */
  sustainedMs: number;
  /** An utterance with less voiced time than this is a cough, and is discarded. */
  minUtteranceMs: number;
  /** An utterance is cut here whatever the level, so a stuck signal cannot run forever. */
  maxUtteranceMs: number;
  /** How quickly the floor follows the room during silence, per sample. */
  floorAlpha: number;
}

const DEFAULT_ENDPOINTER_CONFIG: EndpointerConfig = {
  calibrationMs: 500,
  listenMargin: 0.12,
  bargeInMargin: 0.25,
  onsetMs: 150,
  earlyGraceMs: 1500,
  lateGraceMs: 800,
  sustainedMs: 3000,
  minUtteranceMs: 400,
  maxUtteranceMs: 60_000,
  floorAlpha: 0.05,
};

/** Whose turn the room is in: the threshold is higher while the coach speaks. */
export type EndpointerMode = 'listen' | 'bargeIn';

export type EndpointerState = 'calibrating' | 'quiet' | 'onset' | 'speech';

export type EndpointEvent =
  /** Speech has been confirmed; the utterance began roughly `onsetMs` ago. */
  | { type: 'start' }
  /** The utterance ended and is long enough to be worth transcribing. */
  | { type: 'end'; voicedMs: number }
  /** The utterance ended but was too short to be speech. */
  | { type: 'discard' };

/** Hysteresis: once speech is open, it stays open at a fraction of the entry margin. */
const HOLD_FRACTION = 0.6;

export class Endpointer {
  private readonly config: EndpointerConfig;
  private mode: EndpointerMode = 'listen';
  private _state: EndpointerState = 'calibrating';
  private floor = 0;
  private calibrationStartedAt: number | null = null;
  private calibrationSum = 0;
  private calibrationCount = 0;
  private onsetAt = 0;
  private speechStartedAt = 0;
  private lastVoicedAt = 0;
  private voicedMs = 0;
  private previousAt: number | null = null;

  constructor(config: Partial<EndpointerConfig> = {}) {
    this.config = { ...DEFAULT_ENDPOINTER_CONFIG, ...config };
  }

  get state(): EndpointerState {
    return this._state;
  }

  /** The room's estimated level; meaningful once calibration has finished. */
  get noiseFloor(): number {
    return this.floor;
  }

  setMode(mode: EndpointerMode): void {
    this.mode = mode;
  }

  /**
   * Back to quiet. The floor is kept when asked: un-muting should not spend
   * half a second recalibrating a room that has not changed.
   */
  reset(options: { keepFloor?: boolean } = {}): void {
    const calibrated = this.calibrationStartedAt !== null && this._state !== 'calibrating';
    this._state = options.keepFloor && calibrated ? 'quiet' : 'calibrating';
    if (this._state === 'calibrating') {
      this.floor = 0;
      this.calibrationStartedAt = null;
      this.calibrationSum = 0;
      this.calibrationCount = 0;
    }
    this.voicedMs = 0;
    this.previousAt = null;
  }

  /** One level sample at time `at` (ms). Returns the event it caused, if any. */
  push(level: number, at: number): EndpointEvent | null {
    const event = this.step(level, at);
    this.previousAt = at;
    return event;
  }

  private step(level: number, at: number): EndpointEvent | null {
    const { config } = this;
    if (this._state === 'calibrating') {
      if (this.calibrationStartedAt === null) this.calibrationStartedAt = at;
      this.calibrationSum += level;
      this.calibrationCount += 1;
      if (at - this.calibrationStartedAt >= config.calibrationMs) {
        this.floor = this.calibrationSum / this.calibrationCount;
        this._state = 'quiet';
      }
      return null;
    }

    const margin = this.mode === 'bargeIn' ? config.bargeInMargin : config.listenMargin;
    const threshold = this.floor + margin;
    const hold = this.floor + margin * HOLD_FRACTION;

    switch (this._state) {
      case 'quiet':
        if (level >= threshold) {
          this._state = 'onset';
          this.onsetAt = at;
        } else if (this.mode === 'listen') {
          // Only a quiet room teaches the floor. While the coach talks, what
          // reaches the mic is their residual echo, and learning it would leave
          // the threshold inflated once they stop.
          this.floor += (level - this.floor) * config.floorAlpha;
        }
        return null;

      case 'onset':
        if (level < hold) {
          this._state = 'quiet';
          return null;
        }
        if (at - this.onsetAt >= config.onsetMs) {
          this._state = 'speech';
          this.speechStartedAt = this.onsetAt;
          this.lastVoicedAt = at;
          this.voicedMs = at - this.onsetAt;
          return { type: 'start' };
        }
        return null;

      case 'speech': {
        const voiced = level >= hold;
        if (voiced) {
          this.voicedMs += at - (this.previousAt ?? at);
          this.lastVoicedAt = at;
        }
        const silence = voiced ? 0 : at - this.lastVoicedAt;
        const grace = this.voicedMs >= config.sustainedMs ? config.lateGraceMs : config.earlyGraceMs;
        const tooLong = at - this.speechStartedAt >= config.maxUtteranceMs;
        if (silence < grace && !tooLong) return null;

        this._state = 'quiet';
        return this.voicedMs >= config.minUtteranceMs
          ? { type: 'end', voicedMs: this.voicedMs }
          : { type: 'discard' };
      }
    }
  }
}
