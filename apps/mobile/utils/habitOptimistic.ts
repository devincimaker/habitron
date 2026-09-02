import type { Habit, HabitDraft, HabitLogEntry, HabitSection } from '@habits-coach/shared';
import { withHabitDraftDefaults } from '@habits-coach/shared';

export type DateLogs = Map<string, Map<string, HabitLogEntry>>;

function createOptimisticId(kind: string): string {
  return `optimistic-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Mirrors the service: a new habit lands at the bottom of its routine, not at 0. */
export function buildOptimisticHabit(habits: Habit[], draft: HabitDraft): Habit {
  const sectionId = draft.sectionId;
  const siblings = habits.filter((habit) => (habit.sectionId ?? null) === (sectionId ?? null));
  const position = siblings.reduce((max, habit) => Math.max(max, habit.position + 1), 0);

  return {
    id: createOptimisticId('habit'),
    ...withHabitDraftDefaults(draft),
    active: true,
    position,
    createdAt: Date.now(),
  };
}

export function applyHabitDraft(habit: Habit, draft: HabitDraft): Habit {
  return { ...habit, ...withHabitDraftDefaults(draft), updatedAt: Date.now() };
}

export function buildOptimisticSection(sections: HabitSection[], name: string): HabitSection {
  return {
    id: createOptimisticId('section'),
    name: name.trim(),
    sortOrder: sections.length,
    alarmEnabled: false,
    alarmByDay: {},
  };
}

export function withLog(
  dateLogs: DateLogs,
  date: string,
  habitId: string,
  entry: HabitLogEntry | undefined
): DateLogs {
  const next = new Map(dateLogs);
  const logs = new Map(next.get(date) ?? new Map<string, HabitLogEntry>());
  if (entry) logs.set(habitId, entry);
  else logs.delete(habitId);
  next.set(date, logs);
  return next;
}

/** Every cached day, without the habit — the shape a delete leaves behind. */
export function withoutHabitLogs(dateLogs: DateLogs, habitId: string): DateLogs {
  const next = new Map(dateLogs);
  for (const [date, logs] of next) {
    if (!logs.has(habitId)) continue;
    const trimmed = new Map(logs);
    trimmed.delete(habitId);
    next.set(date, trimmed);
  }
  return next;
}
