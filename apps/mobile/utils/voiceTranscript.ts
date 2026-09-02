import type { ChatMessage } from '@habits-coach/shared';

/**
 * The divider above the first message of a spoken run in the transcript:
 * "Spoken · 5 min", or just "Spoken" when the run is under a minute. Null for
 * every other message, so the chat renders it exactly once per run.
 */
export function spokenDividerFor(
  messages: readonly Pick<ChatMessage, 'spoken' | 'timestamp'>[],
  index: number
): string | null {
  const message = messages[index];
  if (!message?.spoken || messages[index - 1]?.spoken) return null;

  let last = index;
  while (messages[last + 1]?.spoken) last += 1;

  const minutes = Math.round((messages[last].timestamp - message.timestamp) / 60_000);
  return minutes >= 1 ? `Spoken · ${minutes} min` : 'Spoken';
}

/** The pill at the top of voice mode: how long this coaching session has run. */
export function formatVoiceStatus(startedAt: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - startedAt) / 60_000));
  return minutes < 1 ? 'Coaching · just started' : `Coaching · ${minutes} min`;
}
