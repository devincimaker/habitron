export interface InlineEstimateContext {
  start: number;
  end: number;
  raw: string;
  minutes: number;
}

// "(15m)", "(1h 50m)", "(2h)", "(1h50m)", "(90 min)", "(1.5h)"
const DURATION_BODY = String.raw`(?:(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?`;
const DURATION_PATTERN = new RegExp(`^\\s*${DURATION_BODY}\\s*$`, 'iu');
const INLINE_ESTIMATE_PATTERN = /\(([^()]*)\)/gu;

export function parseDurationMinutes(input: string): number | null {
  const match = input.match(DURATION_PATTERN);
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    return null;
  }

  const hours = match[1] !== undefined ? Number.parseFloat(match[1].replace(',', '.')) : 0;
  const minutes = match[2] !== undefined ? Number.parseInt(match[2], 10) : 0;
  const total = Math.round(hours * 60 + minutes);

  return total > 0 ? total : null;
}

export function getInlineEstimateContext(text: string): InlineEstimateContext | null {
  INLINE_ESTIMATE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(INLINE_ESTIMATE_PATTERN)) {
    const minutes = parseDurationMinutes(match[1]);
    if (minutes === null) {
      continue;
    }

    const start = match.index ?? 0;
    return {
      start,
      end: start + match[0].length,
      raw: match[0],
      minutes,
    };
  }

  return null;
}

export function stripInlineEstimateToken(text: string) {
  const estimate = getInlineEstimateContext(text);
  if (!estimate) {
    return text;
  }

  return `${text.slice(0, estimate.start)} ${text.slice(estimate.end)}`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

// Step scales with the value: 5m under an hour, 15m up to four hours, 30m beyond.
export function getDurationStep(minutes: number): number {
  if (minutes < 60) return 5;
  if (minutes < 240) return 15;
  return 30;
}

export function incrementDuration(minutes: number): number {
  return minutes + getDurationStep(minutes);
}

export function decrementDuration(minutes: number): number {
  return Math.max(5, minutes - getDurationStep(minutes - 1));
}

export interface EstimateDelta {
  minutes: number;
  tone: 'over' | 'under' | 'exact';
  label: string;
}

export function getEstimateDelta(estimateMinutes: number, actualMinutes: number): EstimateDelta {
  const diff = actualMinutes - estimateMinutes;
  if (diff === 0) {
    return { minutes: 0, tone: 'exact', label: 'spot on' };
  }

  return diff > 0
    ? { minutes: diff, tone: 'over', label: `+${formatDurationMinutes(diff)} over` }
    : { minutes: diff, tone: 'under', label: `${formatDurationMinutes(-diff)} under` };
}
