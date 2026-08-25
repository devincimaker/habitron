const MAX_LENGTH = 48;

/**
 * Provisional session name, taken from the first user message so an open
 * session is readable in the hub. Finalize replaces it with a generated
 * summary. Returns null when the message has nothing usable.
 */
export function deriveSessionName(firstUserMessage: string): string | null {
  const text = firstUserMessage.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= MAX_LENGTH) return text;

  const cut = text.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  const head = lastSpace > MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,.;:!?-]+$/, '')}…`;
}
