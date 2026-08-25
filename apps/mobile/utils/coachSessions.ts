import type { Ionicons } from '@expo/vector-icons';
import type { CoachSkillId, CoachingSessionSummary } from '@habits-coach/shared';

type IoniconName = keyof typeof Ionicons.glyphMap;

const SKILL_LABELS: Record<CoachSkillId, string> = {
  'habit-design': 'Habit design',
  'day-planning': 'Day planning',
  'task-management': 'Task management',
  'general-coach': 'Coaching',
};

const SKILL_ICONS: Record<CoachSkillId, IoniconName> = {
  'habit-design': 'repeat-outline',
  'day-planning': 'sunny-outline',
  'task-management': 'checkbox-outline',
  'general-coach': 'chatbubble-outline',
};

export function getSessionSkillLabel(skillId: CoachSkillId | null | undefined): string {
  return SKILL_LABELS[skillId ?? 'general-coach'];
}

export function getSessionSkillIcon(skillId: CoachSkillId | null | undefined): IoniconName {
  return SKILL_ICONS[skillId ?? 'general-coach'];
}

export function isSessionOpen(session: Pick<CoachingSessionSummary, 'endedAt'>): boolean {
  return session.endedAt === null;
}

/** Open sessions first, then newest first. */
export function sortSessions<T extends Pick<CoachingSessionSummary, 'startedAt' | 'endedAt'>>(
  sessions: T[]
): T[] {
  return [...sessions].sort((a, b) => {
    const openDelta = Number(isSessionOpen(b)) - Number(isSessionOpen(a));
    return openDelta !== 0 ? openDelta : b.startedAt - a.startedAt;
  });
}

/** `Aug 22`, with the year only when it is not the current one. */
export function formatSessionDate(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatRelativeDate(timestamp: number, now: Date): string {
  const date = new Date(timestamp);
  if (isSameDay(date, now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'yesterday';
  return formatSessionDate(timestamp, now);
}

/**
 * Meta line under the session name in the hub. Outcomes, not volume:
 * `Habit design · Open` or `Habit design · 3 memories · Aug 22`.
 */
export function formatSessionMeta(
  session: Pick<CoachingSessionSummary, 'startedAt' | 'endedAt' | 'memoryCount' | 'leadSkillId'>,
  now: Date = new Date()
): string {
  const parts = [getSessionSkillLabel(session.leadSkillId)];
  if (isSessionOpen(session)) {
    parts.push('Open');
    return parts.join(' · ');
  }
  if (session.memoryCount) {
    parts.push(`${session.memoryCount} ${session.memoryCount === 1 ? 'memory' : 'memories'}`);
  }
  parts.push(formatSessionDate(session.startedAt, now));
  return parts.join(' · ');
}

/** Status pill in the session header: `Started Aug 20 · still open` or `Ended Aug 22`. */
export function formatSessionStatus(
  startedAt: number,
  endedAt: number | null,
  now: Date = new Date()
): string {
  if (endedAt === null) {
    return `Started ${formatRelativeDate(startedAt, now)} · still open`;
  }
  return `Ended ${formatRelativeDate(endedAt, now)}`;
}

export function buildMemoryWarning(memoryCount: number | undefined): string {
  if (!memoryCount) return '';
  const noun = memoryCount === 1 ? 'memory' : 'memories';
  return `\n\nThis will also delete ${memoryCount} associated ${noun}.`;
}
