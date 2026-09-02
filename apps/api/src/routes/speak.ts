import { Router, Request, Response } from 'express';
import type { ErrorResponse, SpeakRequest } from '@habits-coach/shared';
import { SPEECH_MIME_TYPE, SPEECH_SAMPLE_RATE, synthesizeSpeech } from '../services/speech.js';
import { authMiddleware } from '../middleware/auth.js';

const router: Router = Router();

/** A coaching sentence is short; anything past this is not one sentence. */
const MAX_TEXT_CHARS = 1_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.slice(0, MAX_TEXT_CHARS) : undefined;
}

/**
 * POST /api/speak — one sentence in, PCM out as it is synthesised. The app
 * calls this once per sentence of a spoken coach turn and plays the chunks as
 * they land. A barge-in drops the connection, which cancels the upstream
 * request: nothing keeps synthesising into a socket nobody is listening to.
 */
export async function handleSpeakRequest(req: Request, res: Response): Promise<void> {
  const { text, previousText, nextText } = (req.body ?? {}) as Partial<SpeakRequest>;

  if (!isNonEmptyString(text)) {
    res.status(400).json({ error: 'Invalid request: text is required' } satisfies ErrorResponse);
    return;
  }
  if (text.length > MAX_TEXT_CHARS) {
    res.status(400).json({
      error: `Invalid request: text is longer than ${MAX_TEXT_CHARS} characters`,
    } satisfies ErrorResponse);
    return;
  }

  const abort = new AbortController();
  req.on('close', () => abort.abort());

  let audio: ReadableStream<Uint8Array>;
  try {
    audio = await synthesizeSpeech(
      { text, previousText: optionalString(previousText), nextText: optionalString(nextText) },
      abort.signal
    );
  } catch (error) {
    if (abort.signal.aborted) return;
    console.error('Speech synthesis error:', error);
    res.status(502).json({ error: 'Speech is unavailable right now.' } satisfies ErrorResponse);
    return;
  }

  res.writeHead(200, {
    'Content-Type': SPEECH_MIME_TYPE,
    'X-Sample-Rate': String(SPEECH_SAMPLE_RATE),
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  try {
    for await (const chunk of audio) {
      if (abort.signal.aborted) break;
      res.write(chunk);
    }
  } catch (error) {
    // The client going away mid-sentence is the normal end of a barge-in.
    if (!abort.signal.aborted) console.error('Speech stream failed:', error);
  } finally {
    res.end();
  }
}

router.post('/', authMiddleware, handleSpeakRequest);

export default router;
