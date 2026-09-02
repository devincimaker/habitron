import { requireNativeModule, type NativeModule } from 'expo-modules-core';

export type MicPermission = 'granted' | 'denied' | 'undetermined';

type VoiceSessionEvents = {
  /** Microphone level, 0–1 on the recorder's scale ((dB + 60) / 60), ~12 times a second. Zero while muted. */
  onLevel(event: { level: number }): void;
  /** Every buffer handed to `enqueueAudio` since the last `finishPlayback` has left the speaker. */
  onPlaybackDone(): void;
  /** The engine stopped on its own: an interruption, a route it could not follow. The session is over. */
  onError(event: { message: string }): void;
};

/**
 * One AVAudioEngine in voice-processing mode: the mic and the speaker share
 * it so iOS cancels the coach's voice out of what the mic hears. Playback is
 * raw 24 kHz int16 mono PCM, the format /api/speak streams; captured
 * utterances are 16 kHz WAV files for /api/transcribe.
 */
declare class VoiceSessionNativeModule extends NativeModule<VoiceSessionEvents> {
  getPermission(): MicPermission;
  requestPermission(): Promise<boolean>;
  /** Claims the audio session and starts the engine. Idempotent. */
  start(): Promise<void>;
  /** Releases the audio session so other recorders can have it. Idempotent. */
  stop(): Promise<void>;
  /** Muted: levels read zero and nothing is kept for an utterance. Playback continues. */
  setMuted(muted: boolean): void;
  /** Opens a capture file, seeded with the last half second so the first syllable is not lost. */
  beginUtterance(): void;
  /** Closes the capture file and returns its `file://` URI, or null if nothing was open. */
  endUtterance(): Promise<string | null>;
  /** Closes and deletes the capture file. */
  cancelUtterance(): void;
  /** Schedules a chunk of int16 LE 24 kHz mono PCM. Chunks play back to back in call order. */
  enqueueAudio(bytes: Uint8Array): void;
  /** No more chunks are coming: `onPlaybackDone` fires once the last one has played. */
  finishPlayback(): void;
  /** Drops everything queued and playing, at once. */
  stopPlayback(): void;
}

export default requireNativeModule<VoiceSessionNativeModule>('VoiceSession');
