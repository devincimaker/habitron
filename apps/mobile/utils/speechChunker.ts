/**
 * Splits a streamed coach reply into sentences as the deltas arrive, so the
 * first one can be spoken while the rest is still being written. Free of
 * React and of the network: what counts as a sentence is a tuning decision.
 */

/** Markdown → something a voice can say: the marks go, the words stay. */
export function toSpokenText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}(?:[-*•]|\d+[.)])[ \t]+/gm, '')
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/(\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export interface SentenceChunker {
  /** Feeds one text delta; returns the chunks that are now ready to speak. */
  push(delta: string): string[];
  /** Whatever never reached a boundary, once the reply has ended. */
  flush(): string | null;
}

export interface SentenceChunkerOptions {
  /**
   * After the first sentence, chunks are merged until they reach this many
   * characters: "Okay." on its own is a request, a seam and a prosody reset
   * for one word. The first sentence goes out at once, whatever its length —
   * that is the latency that matters.
   */
  minChars?: number;
}

/** A sentence ends at terminal punctuation followed by whitespace, or at a paragraph break. */
const BOUNDARY = /[.!?…]+["')\]]*\s+|\n{2,}/g;

export function createSentenceChunker(options: SentenceChunkerOptions = {}): SentenceChunker {
  const minChars = options.minChars ?? 40;
  let buffer = '';
  let pending = '';
  let emitted = 0;

  function take(): string | null {
    const text = toSpokenText(pending);
    pending = '';
    if (!text) return null;
    emitted += 1;
    return text;
  }

  return {
    push(delta) {
      buffer += delta;
      const ready: string[] = [];
      let consumed = 0;
      BOUNDARY.lastIndex = 0;
      for (let match = BOUNDARY.exec(buffer); match; match = BOUNDARY.exec(buffer)) {
        pending += buffer.slice(consumed, match.index + match[0].length);
        consumed = match.index + match[0].length;
        if (emitted === 0 || pending.trim().length >= minChars) {
          const chunk = take();
          if (chunk) ready.push(chunk);
        }
      }
      buffer = buffer.slice(consumed);
      return ready;
    },
    flush() {
      pending += buffer;
      buffer = '';
      return take();
    },
  };
}
