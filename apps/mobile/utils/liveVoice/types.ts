import type { CoachStreamEvent, CoachTurnRecord } from '@habits-coach/shared';
import type { Endpointer } from '../endpointing';
import type { FetchSpeech, SpeechPlayer } from './speechQueue';

export type VoicePhase =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface VoiceSnapshot {
  phase: VoicePhase;
  muted: boolean;
  /** The user cut the coach off and the coach has not answered yet. */
  interrupted: boolean;
  /** What the user last said, once transcribed. */
  userText: string | null;
  /** The coach's reply in this turn, as far as it has streamed. */
  coachText: string;
  /** How much of `coachText` has been sent to the speaker. */
  spokenChars: number;
  /** "Looking at your tasks…" while the coach works. */
  activity: string | null;
  /** Something the user should read but that did not end the session. */
  notice: string | null;
  /** Why the session ended on its own. */
  error: string | null;
}

interface VoiceEventSubscription {
  remove(): void;
}

/** The native module's surface, as the controller sees it. */
interface VoiceAudio extends SpeechPlayer {
  start(): Promise<void>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  beginUtterance(): void;
  endUtterance(): Promise<string | null>;
  cancelUtterance(): void;
  addListener(name: 'onLevel', listener: (event: { level: number }) => void): VoiceEventSubscription;
  addListener(name: 'onPlaybackDone', listener: () => void): VoiceEventSubscription;
  addListener(name: 'onError', listener: (event: { message: string }) => void): VoiceEventSubscription;
}

/** The session transcript: every exchange lands there as an ordinary message. */
interface VoiceTranscript {
  addUser(text: string): Promise<void>;
  startAssistant(delta: string): string;
  appendAssistant(id: string, delta: string): void;
  finalizeAssistant(id: string, content: string): Promise<void>;
  addAssistant(content: string): Promise<void>;
}

type FinishedTurn = Exclude<CoachTurnRecord, { status: 'running' }>;

export interface VoiceControllerDeps {
  audio: VoiceAudio;
  transcribe(uri: string): Promise<string>;
  streamTurn(prompt: string, onEvent: (event: CoachStreamEvent) => void): Promise<void>;
  /** After a dropped stream: how the server says the turn ended, or null when it cannot tell. */
  recoverTurn(prompt: string): Promise<FinishedTurn | null>;
  fetchSpeech: FetchSpeech;
  transcript: VoiceTranscript;
  describeActivity(toolName: string): string;
  /** A turn failed outright; returns what to show. */
  explainTurnError(error: unknown): string;
  /** A turn ended: the coach may have changed real data. */
  onTurnFinished(): void;
  now?(): number;
  endpointer?: Endpointer;
}
