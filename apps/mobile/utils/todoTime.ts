import { getTodayDate } from '@habits-coach/shared';

const TIME_WITH_COLON_PATTERN = /^(\d{1,2}):(\d{2})$/;
const TIME_DIGITS_ONLY_PATTERN = /^\d{1,4}$/;

function isValidHourMinute(hour: number, minute: number): boolean {
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function normalizeTodoScheduledTimeInput(input?: string | null): string | undefined | null {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  const colonMatch = trimmed.match(TIME_WITH_COLON_PATTERN);
  if (colonMatch) {
    const hour = Number.parseInt(colonMatch[1], 10);
    const minute = Number.parseInt(colonMatch[2], 10);

    if (!isValidHourMinute(hour, minute)) {
      return null;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  if (!TIME_DIGITS_ONLY_PATTERN.test(trimmed)) {
    return null;
  }

  const digits = trimmed.padStart(trimmed.length <= 2 ? 2 : 4, '0');
  const hour = trimmed.length <= 2
    ? Number.parseInt(digits, 10)
    : Number.parseInt(digits.slice(0, digits.length - 2), 10);
  const minute = trimmed.length <= 2
    ? 0
    : Number.parseInt(digits.slice(-2), 10);

  if (!isValidHourMinute(hour, minute)) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatTodoScheduledTime(time?: string): string | null {
  const normalized = normalizeTodoScheduledTimeInput(time);
  if (!normalized) {
    return null;
  }
  return normalized;
}

export function resolveNewTodoSchedule(
  scheduledDate?: string,
  scheduledTime?: string | null
): { scheduledDate?: string; scheduledTime?: string } | null {
  const normalizedTime = normalizeTodoScheduledTimeInput(scheduledTime);

  if (normalizedTime === null) {
    return null;
  }

  return {
    scheduledDate: normalizedTime ? scheduledDate ?? getTodayDate() : scheduledDate,
    scheduledTime: normalizedTime ?? undefined,
  };
}

export function compareTodoScheduledTimes(a?: string, b?: string): number {
  const normalizedA = normalizeTodoScheduledTimeInput(a);
  const normalizedB = normalizeTodoScheduledTimeInput(b);

  if (normalizedA && normalizedB) {
    return normalizedA.localeCompare(normalizedB);
  }

  if (normalizedA) {
    return -1;
  }

  if (normalizedB) {
    return 1;
  }

  return 0;
}
