import type { HabitWeekday } from '@habits-coach/shared';

type HabitFrequency = 'daily' | 'weekly' | 'interval';
type HabitGoalType = 'boolean' | 'quantity';
type HabitCheckInMode = 'auto' | 'manual' | 'complete_all';

/**
 * Everything the coach can set on a habit. Every field optional: `create` fills
 * the gaps with defaults, `update` leaves them alone.
 */
export interface HabitFields {
  name?: string;
  frequency?: HabitFrequency;
  weeklyDays?: HabitWeekday[];
  weeklyCount?: number;
  intervalDays?: number;
  startDate?: string;
  goalDays?: number;
  goalType?: HabitGoalType;
  targetAmount?: number;
  unit?: string;
  checkInMode?: HabitCheckInMode;
  recordIncrement?: number;
  reason?: string;
  icon?: string;
  constantReminder?: boolean;
}

/** The effective mode of the habit being patched, so a partial update can be checked. */
export interface ExistingHabitMode {
  frequency: HabitFrequency;
  goalType: HabitGoalType;
  checkInMode: HabitCheckInMode;
}

export interface HabitRowContext {
  /** Today in the user's timezone, for the `startDate` default on create. */
  today: string;
  /** Already resolved from a section name; `null` clears it, `undefined` leaves it. */
  sectionId?: string | null;
  /** Present for an update, absent for a create. */
  existing?: ExistingHabitMode;
}

/**
 * Which fields belong to which mode. The coupling mirrors
 * `apps/mobile/services/habits.ts` `toDbHabitFields`, including the part that
 * surprises everyone: weekday pinning lives on `daily`, not on `weekly`.
 */
const FREQUENCY_FIELDS: Record<HabitFrequency, readonly (keyof HabitFields)[]> = {
  daily: ['weeklyDays'],
  weekly: ['weeklyCount'],
  interval: ['intervalDays'],
};

const GOAL_FIELDS: Record<HabitGoalType, readonly (keyof HabitFields)[]> = {
  boolean: [],
  quantity: ['targetAmount', 'unit', 'checkInMode', 'recordIncrement'],
};

/** Thrown for a field that contradicts the chosen mode, so the model can correct itself. */
export class HabitFieldConflict extends Error {}

function conflict(message: string): never {
  throw new HabitFieldConflict(message);
}

function rejectForeignFields(
  input: HabitFields,
  frequency: HabitFrequency,
  goalType: HabitGoalType
): void {
  for (const [mode, fields] of Object.entries(FREQUENCY_FIELDS) as [
    HabitFrequency,
    readonly (keyof HabitFields)[],
  ][]) {
    if (mode === frequency) continue;
    for (const field of fields) {
      if (input[field] !== undefined) {
        conflict(`${field} only applies to ${mode} habits, and this habit is ${frequency}.`);
      }
    }
  }

  if (goalType === 'boolean') {
    for (const field of GOAL_FIELDS.quantity) {
      if (input[field] !== undefined) {
        conflict(`${field} only applies to quantity habits, and this habit is boolean.`);
      }
    }
  }
}

function resolveCheckInMode(
  input: HabitFields,
  goalType: HabitGoalType,
  existing?: ExistingHabitMode
): HabitCheckInMode {
  if (goalType !== 'quantity') return 'auto';
  return input.checkInMode ?? existing?.checkInMode ?? 'auto';
}

function rejectIncrementWithoutAuto(
  input: HabitFields,
  goalType: HabitGoalType,
  checkInMode: HabitCheckInMode
): void {
  if (input.recordIncrement === undefined) return;
  if (goalType === 'quantity' && checkInMode === 'auto') return;
  conflict(
    `recordIncrement only applies to quantity habits with checkInMode 'auto', and this habit is ${goalType}/${checkInMode}.`
  );
}

/**
 * Fields the new mode needs and cannot sensibly default. Switching to `interval`
 * without a length, or to `quantity` without a target, would silently invent the
 * user's intent, so those are rejected instead.
 */
function requireModeFields(
  input: HabitFields,
  frequency: HabitFrequency,
  goalType: HabitGoalType,
  existing: ExistingHabitMode
): void {
  if (frequency === 'interval' && existing.frequency !== 'interval' && input.intervalDays === undefined) {
    conflict('Changing a habit to interval needs intervalDays — how many days between check-ins.');
  }
  if (goalType === 'quantity' && existing.goalType !== 'quantity' && input.targetAmount === undefined) {
    conflict('Changing a habit to a quantity goal needs targetAmount — how much counts as done.');
  }
}

/**
 * The `habits` row for a create or a patch. Pure: the caller resolves the
 * section name to an id and supplies today's date.
 *
 * On create every column is written, defaults included. On update only the keys
 * the patch touches are present — except when the mode changes, where the old
 * mode's columns are explicitly nulled so no stale value survives.
 */
export function habitRowFromInput(
  input: HabitFields,
  context: HabitRowContext
): Record<string, unknown> {
  const { today, sectionId, existing } = context;
  const isCreate = existing === undefined;

  if (isCreate && !input.name?.trim()) {
    conflict('name is required to create a habit.');
  }

  const frequency = input.frequency ?? existing?.frequency ?? 'daily';
  const goalType = input.goalType ?? existing?.goalType ?? 'boolean';

  rejectForeignFields(input, frequency, goalType);
  const checkInMode = resolveCheckInMode(input, goalType, existing);
  rejectIncrementWithoutAuto(input, goalType, checkInMode);
  if (existing) requireModeFields(input, frequency, goalType, existing);

  const row = isCreate
    ? createRow(input, today, frequency, goalType, checkInMode)
    : patchRow(input, existing, frequency, goalType, checkInMode);

  if (sectionId !== undefined) row.section_id = sectionId;
  else if (isCreate) row.section_id = null;

  return row;
}

/** The three frequency columns at once: the active one set, the other two nulled. */
function frequencyColumns(input: HabitFields, frequency: HabitFrequency): Record<string, unknown> {
  return {
    frequency,
    weekly_days: frequency === 'daily' ? input.weeklyDays ?? null : null,
    weekly_count: frequency === 'weekly' ? input.weeklyCount ?? 1 : null,
    interval_days: frequency === 'interval' ? input.intervalDays ?? 2 : null,
  };
}

/** The goal columns at once, on the same rule. */
function goalColumns(
  input: HabitFields,
  goalType: HabitGoalType,
  checkInMode: HabitCheckInMode
): Record<string, unknown> {
  const isQuantity = goalType === 'quantity';
  return {
    goal_type: goalType,
    target_amount: isQuantity ? input.targetAmount ?? 1 : null,
    unit: isQuantity ? input.unit ?? 'Count' : null,
    check_in_mode: checkInMode,
    record_increment: isQuantity && checkInMode === 'auto' ? input.recordIncrement ?? 1 : null,
  };
}

function createRow(
  input: HabitFields,
  today: string,
  frequency: HabitFrequency,
  goalType: HabitGoalType,
  checkInMode: HabitCheckInMode
): Record<string, unknown> {
  return {
    name: input.name?.trim(),
    ...frequencyColumns(input, frequency),
    ...goalColumns(input, goalType, checkInMode),
    start_date: input.startDate ?? today,
    goal_days: input.goalDays ?? null,
    reason: input.reason ?? null,
    icon: input.icon ?? null,
    constant_reminder: input.constantReminder ?? false,
  };
}

/**
 * Only the columns the patch touches, so a field the coach never mentioned keeps
 * its value. Naming `frequency` or `goalType` rewrites that whole block, which is
 * what clears the old mode; naming one field inside a block touches only it.
 */
function patchRow(
  input: HabitFields,
  existing: ExistingHabitMode,
  frequency: HabitFrequency,
  goalType: HabitGoalType,
  checkInMode: HabitCheckInMode
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (input.frequency !== undefined || frequency !== existing.frequency) {
    Object.assign(row, frequencyColumns(input, frequency));
  } else {
    if (input.weeklyDays !== undefined) row.weekly_days = input.weeklyDays;
    if (input.weeklyCount !== undefined) row.weekly_count = input.weeklyCount;
    if (input.intervalDays !== undefined) row.interval_days = input.intervalDays;
  }

  if (input.goalType !== undefined || goalType !== existing.goalType) {
    Object.assign(row, goalColumns(input, goalType, checkInMode));
  } else {
    if (input.targetAmount !== undefined) row.target_amount = input.targetAmount;
    if (input.unit !== undefined) row.unit = input.unit;
    if (input.checkInMode !== undefined) {
      row.check_in_mode = checkInMode;
      // The increment only exists under 'auto', so a mode change decides it.
      row.record_increment = checkInMode === 'auto' ? input.recordIncrement ?? 1 : null;
    } else if (input.recordIncrement !== undefined) {
      row.record_increment = input.recordIncrement;
    }
  }

  if (input.name !== undefined) row.name = input.name.trim();
  if (input.startDate !== undefined) row.start_date = input.startDate;
  if (input.goalDays !== undefined) row.goal_days = input.goalDays;
  if (input.reason !== undefined) row.reason = input.reason;
  if (input.icon !== undefined) row.icon = input.icon;
  if (input.constantReminder !== undefined) row.constant_reminder = input.constantReminder;

  return row;
}
