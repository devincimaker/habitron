import {
  getTodayDate,
  withHabitDraftDefaults,
  type Habit,
  type HabitDraft,
  type HabitFrequency,
  type HabitGoal,
  type HabitWeekday,
} from '@habits-coach/shared';
import type { HabitIconName } from './habitIcons';
import { getDefaultWeeklyDays } from './habitSchedule';

/** Everything the composer's details step edits, in the shape the pickers hand back. */
export interface HabitDetailsState {
  frequency: HabitFrequency;
  weeklyDays: HabitWeekday[];
  weeklyCount: number;
  intervalDays: number;
  goal: HabitGoal;
  startDate: string;
  goalDays?: number;
  sectionId?: string;
  reminderTimes: string[];
  constantReminder: boolean;
  autoPopupLog: boolean;
  reason: string;
}

export interface HabitDraftState extends HabitDetailsState {
  name: string;
  icon: HabitIconName;
}

const DEFAULT_GOAL: HabitGoal = { goalType: 'boolean', checkInMode: 'auto' };

/** The details step's starting state: the habit being edited, or the defaults for a new one. */
export function detailsStateFor(
  habit: Habit | null | undefined,
  defaultSectionId?: string
): HabitDetailsState {
  return {
    frequency: habit?.frequency ?? 'daily',
    weeklyDays: habit?.weeklyDays ?? getDefaultWeeklyDays(),
    weeklyCount: habit?.weeklyCount ?? 1,
    intervalDays: habit?.intervalDays ?? 2,
    goal: habit
      ? {
          goalType: habit.goalType,
          targetAmount: habit.targetAmount,
          unit: habit.unit,
          checkInMode: habit.checkInMode,
          recordIncrement: habit.recordIncrement,
        }
      : DEFAULT_GOAL,
    startDate: habit?.startDate ?? getTodayDate(),
    goalDays: habit?.goalDays,
    sectionId: habit?.sectionId ?? defaultSectionId,
    reminderTimes: habit?.reminderTimes ?? [],
    constantReminder: habit?.constantReminder ?? false,
    autoPopupLog: habit?.autoPopupLog ?? false,
    reason: habit?.reason ?? '',
  };
}

/** The one rule the pickers cannot enforce: a daily habit needs at least one day. */
export function scheduleErrorFor(details: HabitDetailsState): string | null {
  if (details.frequency === 'daily' && details.weeklyDays.length === 0) {
    return 'Select at least one day for a daily habit.';
  }

  return null;
}

export function describeGoal(goal: HabitGoal): string {
  if (goal.goalType === 'boolean') {
    return 'Achieve it all';
  }

  return `${goal.targetAmount ?? 1} ${goal.unit ?? 'Count'}`;
}

/** Flattens composer state into the draft the store saves; the shared defaults gate the schedule and goal fields by kind. */
export function buildHabitDraft(state: HabitDraftState): HabitDraft {
  const { name, reason, goal, ...details } = state;

  return withHabitDraftDefaults({
    ...details,
    ...goal,
    name: name.trim(),
    reason: reason.trim() || undefined,
  });
}
