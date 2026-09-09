import type { TaskRepeatFrequency, TaskRepeatRule } from '@habits-coach/shared';
import { getWeekday } from './todoRepeat';

export interface InlineRepeatContext {
  start: number;
  end: number;
  raw: string;
  frequency: TaskRepeatFrequency;
  /** Absent when the phrase names no day ("every week"): the task's own weekday. */
  weekdays?: number[];
}

const DAY_NAMES = [
  'sun(?:day)?',
  'mon(?:day)?',
  'tue(?:s(?:day)?)?',
  'wed(?:nesday)?',
  'thu(?:rs(?:day)?)?',
  'fri(?:day)?',
  'sat(?:urday)?',
];
const DAY = `(?:${DAY_NAMES.join('|')})s?`;
const DAY_LIST = `${DAY}(?:\\s*(?:,|/|&|and)\\s*${DAY})*`;
const EVERY =
  `every\\s+(?:(?:other|second)\\s+|(?:2|two)\\s+weeks?\\s+(?:on\\s+)?)?` +
  `(?:day|weekday|week|month|${DAY_LIST})`;
const INLINE_REPEAT_PATTERN = new RegExp(
  `(^|\\s)(${EVERY}|daily|weekly|biweekly|fortnightly|monthly)(?=$|\\s|[.,;!?])`,
  'iu'
);
const DAY_TOKEN_PATTERN = new RegExp(`\\b(${DAY_NAMES.join('|')})s?\\b`, 'giu');
const BIWEEKLY_PATTERN = /\b(?:other|second|2|two|biweekly|fortnightly)\b/iu;

function parseWeekdays(phrase: string): number[] | undefined {
  if (/\bweekday\b/iu.test(phrase)) return [1, 2, 3, 4, 5];
  if (/\b(?:every\s+day|daily)\b/iu.test(phrase)) return [0, 1, 2, 3, 4, 5, 6];
  const days = new Set<number>();
  for (const match of phrase.matchAll(DAY_TOKEN_PATTERN)) {
    days.add(DAY_NAMES.findIndex((name) => new RegExp(`^${name}$`, 'iu').test(match[1])));
  }
  return days.size > 0 ? [...days].sort() : undefined;
}

/** The first "every …" phrase on the line, as a rule that may still need a day. */
export function getInlineRepeatContext(text: string): InlineRepeatContext | null {
  const match = INLINE_REPEAT_PATTERN.exec(text);
  if (!match) return null;
  const raw = match[2];
  const start = match.index + match[1].length;
  const frequency: TaskRepeatFrequency = /\bmonth/iu.test(raw)
    ? 'monthly'
    : BIWEEKLY_PATTERN.test(raw)
      ? 'biweekly'
      : 'weekly';
  const weekdays = frequency === 'monthly' ? undefined : parseWeekdays(raw);
  return { start, end: start + raw.length, raw, frequency, ...(weekdays ? { weekdays } : {}) };
}

/** "Every week" with no day named means the day the task lands on. */
export function resolveInlineRepeat(context: InlineRepeatContext, anchorDate: string): TaskRepeatRule {
  return {
    frequency: context.frequency,
    weekdays:
      context.frequency === 'monthly' ? [] : (context.weekdays ?? [getWeekday(anchorDate)]),
  };
}

export function stripInlineRepeatToken(text: string): string {
  const context = getInlineRepeatContext(text);
  if (!context) return text;
  return `${text.slice(0, context.start)} ${text.slice(context.end)}`.replace(/\s+/gu, ' ').trim();
}
