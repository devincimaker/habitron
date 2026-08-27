import type { ChecklistItemDraft, Habit, HabitDraft } from '../types';

/** Plain strings become new items; drafts with an id refer to existing items. */
export function normalizeChecklistDraft(
  checklist: string[] | ChecklistItemDraft[]
): ChecklistItemDraft[] {
  return checklist
    .map((item) => (typeof item === 'string' ? { title: item } : item))
    .map((item) => ({ ...item, title: item.title.trim() }))
    .filter((item) => item.title.length > 0);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}


/**
 * The subset of a habit draft that callers (UI, coach proposals) must provide;
 * everything else falls back to sensible defaults via `withHabitDraftDefaults`.
 */
export type HabitDraftInput = Pick<HabitDraft, 'name' | 'frequency'> &
  Partial<Omit<HabitDraft, 'name' | 'frequency'>>;

export function withHabitDraftDefaults(input: HabitDraftInput): HabitDraft {
  return {
    name: input.name,
    reason: input.reason,
    icon: input.icon,
    frequency: input.frequency,
    weeklyDays: input.frequency === 'daily' ? input.weeklyDays : undefined,
    weeklyCount: input.frequency === 'weekly' ? input.weeklyCount ?? 1 : undefined,
    intervalDays: input.frequency === 'interval' ? input.intervalDays ?? 2 : undefined,
    startDate: input.startDate ?? getTodayDate(),
    goalDays: input.goalDays,
    goalType: input.goalType ?? 'boolean',
    targetAmount: input.goalType === 'quantity' ? input.targetAmount ?? 1 : undefined,
    unit: input.goalType === 'quantity' ? input.unit ?? 'Count' : undefined,
    checkInMode: input.checkInMode ?? 'auto',
    recordIncrement:
      input.goalType === 'quantity' && (input.checkInMode ?? 'auto') === 'auto'
        ? input.recordIncrement ?? 1
        : undefined,
    sectionId: input.sectionId,
    reminderTimes: input.reminderTimes ?? [],
    constantReminder: input.constantReminder ?? false,
  };
}

export function habitToDraft(habit: Habit): HabitDraft {
  return {
    name: habit.name,
    reason: habit.reason,
    icon: habit.icon,
    frequency: habit.frequency,
    weeklyDays: habit.weeklyDays,
    weeklyCount: habit.weeklyCount,
    intervalDays: habit.intervalDays,
    startDate: habit.startDate,
    goalDays: habit.goalDays,
    goalType: habit.goalType,
    targetAmount: habit.targetAmount,
    unit: habit.unit,
    checkInMode: habit.checkInMode,
    recordIncrement: habit.recordIncrement,
    sectionId: habit.sectionId,
    reminderTimes: habit.reminderTimes,
    constantReminder: habit.constantReminder,
  };
}
