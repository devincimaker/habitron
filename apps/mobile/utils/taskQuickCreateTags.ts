import type { TodoDraft } from '@habits-coach/shared';
import { normalizeTodoScheduledTimeInput, resolveNewTodoSchedule } from './todoTime';

export interface TextSelectionRange {
  start: number;
  end: number;
}

export interface ActiveInlineTagContext {
  start: number;
  end: number;
  raw: string;
  query: string;
}

export interface InlineScheduledTimeContext {
  start: number;
  end: number;
  raw: string;
  normalizedTime: string;
}

export interface QuickCreateTextSegment {
  text: string;
  kind: 'default' | 'scheduledTime';
}

const INLINE_TAG_TOKEN_PATTERN = /^#[\p{L}\p{N}_-]*$/u;
const INLINE_TAG_VALUE_PATTERN = /[\p{L}\p{N}_-]/u;
const INLINE_TIME_TOKEN_PATTERN = /(^|\s)((?:[01]?\d|2[0-3]):[0-5]\d)(?=$|\s)/gu;

function isWhitespace(character?: string) {
  return !!character && /\s/u.test(character);
}

function isInlineTagValueCharacter(character?: string) {
  return !!character && INLINE_TAG_VALUE_PATTERN.test(character);
}

function clampSelectionValue(value: number, length: number) {
  return Math.max(0, Math.min(value, length));
}

export function getInlineTagNames(text: string): string[] {
  const uniqueTagNames = new Map<string, string>();

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '#' || (index > 0 && !isWhitespace(text[index - 1]))) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < text.length && isInlineTagValueCharacter(text[cursor])) {
      cursor += 1;
    }

    if (cursor === index + 1) {
      continue;
    }

    const tagName = text.slice(index + 1, cursor);
    const normalizedTagName = tagName.toLowerCase();
    if (!uniqueTagNames.has(normalizedTagName)) {
      uniqueTagNames.set(normalizedTagName, tagName);
    }

    index = cursor - 1;
  }

  return Array.from(uniqueTagNames.values());
}

export function stripInlineTagTokens(text: string) {
  return text
    .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function getInlineScheduledTimeContext(
  text: string
): InlineScheduledTimeContext | null {
  INLINE_TIME_TOKEN_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(INLINE_TIME_TOKEN_PATTERN)) {
    const raw = match[2];
    const normalizedTime = normalizeTodoScheduledTimeInput(raw);
    if (!normalizedTime) {
      continue;
    }

    const prefix = match[1] ?? '';
    const start = (match.index ?? 0) + prefix.length;
    const end = start + raw.length;

    return {
      start,
      end,
      raw,
      normalizedTime,
    };
  }

  return null;
}

export function stripInlineScheduledTimeToken(text: string) {
  const scheduledTime = getInlineScheduledTimeContext(text);
  if (!scheduledTime) {
    return text.replace(/\s+/gu, ' ').trim();
  }

  return `${text.slice(0, scheduledTime.start)} ${text.slice(scheduledTime.end)}`
    .replace(/\s+/gu, ' ')
    .trim();
}

export function buildQuickCreateTodoDraft(text: string): TodoDraft | null {
  const schedule = resolveNewTodoSchedule(undefined, getInlineScheduledTimeContext(text)?.normalizedTime);
  if (schedule === null) {
    return null;
  }

  const title = stripInlineTagTokens(stripInlineScheduledTimeToken(text));
  if (!title) {
    return null;
  }

  const tagNames = getInlineTagNames(text);
  return {
    title,
    ...(tagNames.length > 0 ? { tagNames } : {}),
    ...(schedule.scheduledTime ? schedule : {}),
  };
}

export function getQuickCreateTextSegments(text: string): QuickCreateTextSegment[] {
  const scheduledTime = getInlineScheduledTimeContext(text);
  if (!scheduledTime) {
    return [{ text, kind: 'default' }];
  }

  const segments: QuickCreateTextSegment[] = [];
  if (scheduledTime.start > 0) {
    segments.push({
      text: text.slice(0, scheduledTime.start),
      kind: 'default',
    });
  }

  segments.push({
    text: text.slice(scheduledTime.start, scheduledTime.end),
    kind: 'scheduledTime',
  });

  if (scheduledTime.end < text.length) {
    segments.push({
      text: text.slice(scheduledTime.end),
      kind: 'default',
    });
  }

  return segments;
}

export function getActiveInlineTagContext(
  text: string,
  selection: TextSelectionRange
): ActiveInlineTagContext | null {
  if (selection.start !== selection.end) {
    return null;
  }

  const caret = clampSelectionValue(selection.start, text.length);
  let start = caret;
  while (start > 0 && !isWhitespace(text[start - 1])) {
    start -= 1;
  }

  let end = caret;
  while (end < text.length && !isWhitespace(text[end])) {
    end += 1;
  }

  if (caret <= start) {
    return null;
  }

  const raw = text.slice(start, end);
  if (!raw.startsWith('#') || !INLINE_TAG_TOKEN_PATTERN.test(raw)) {
    return null;
  }

  return {
    start,
    end,
    raw,
    query: raw.slice(1),
  };
}

export function insertTagTriggerAtSelection(
  text: string,
  selection: TextSelectionRange
) {
  if (getActiveInlineTagContext(text, selection)) {
    return { text, selection };
  }

  const start = clampSelectionValue(selection.start, text.length);
  const end = clampSelectionValue(selection.end, text.length);
  const previousCharacter = start > 0 ? text[start - 1] : undefined;
  const insertionText = previousCharacter && !isWhitespace(previousCharacter) ? ' #' : '#';
  const nextText = `${text.slice(0, start)}${insertionText}${text.slice(end)}`;
  const nextCaret = start + insertionText.length;

  return {
    text: nextText,
    selection: {
      start: nextCaret,
      end: nextCaret,
    },
  };
}

export function replaceActiveInlineTagContext(
  text: string,
  activeTag: ActiveInlineTagContext,
  tagName: string
) {
  const trimmedTagName = tagName.trim();
  if (!trimmedTagName) {
    return {
      text,
      selection: {
        start: activeTag.end,
        end: activeTag.end,
      },
    };
  }

  const nextCharacter = text[activeTag.end];
  const replacement = `#${trimmedTagName}`;
  const suffix = nextCharacter === undefined || !isWhitespace(nextCharacter) ? ' ' : '';
  const replacementText = `${replacement}${suffix}`;
  const nextText = `${text.slice(0, activeTag.start)}${replacementText}${text.slice(activeTag.end)}`;
  const nextCaret = activeTag.start + replacementText.length;

  return {
    text: nextText,
    selection: {
      start: nextCaret,
      end: nextCaret,
    },
  };
}
