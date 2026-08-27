/** The recorder's own mode, as `useVoiceInput` reports it. */
export type VoiceMode = 'idle' | 'recording' | 'transcribing';

/** What the voice pill shows; `idle` means the pill is not shown at all. */
export type VoiceControlMode = VoiceMode | 'error';

/**
 * A failure owns the pill whatever the recorder's mode says — ↻ and ✕ are
 * its only ways out, so a stop that failed before it had audio still shows
 * as an error rather than as idle chips.
 */
export function toVoiceControlMode(
  mode: VoiceMode,
  error: string | null
): VoiceControlMode {
  return error !== null ? 'error' : mode;
}

/**
 * The scrolling waveform's memory: newest level first, at most `size` long.
 * A level is one 0–1 meter sample; the pill draws each as a bar.
 */
export function pushLevelHistory(
  history: readonly number[],
  level: number,
  size: number
): number[] {
  return [level, ...history].slice(0, size);
}
