import type { Habit } from '@habits-coach/shared';
import {
  buildHabitDraft,
  describeGoal,
  detailsStateFor,
  scheduleErrorFor,
  type HabitDraftState,
} from '../utils/habitDraft';

const BASE: HabitDraftState = {
  name: 'Walk',
  reason: '',
  icon: 'walk',
  frequency: 'daily',
  weeklyDays: ['Mon', 'Wed'],
  weeklyCount: 3,
  intervalDays: 4,
  goal: { goalType: 'boolean', checkInMode: 'auto' },
  startDate: '2026-08-26',
  goalDays: 30,
  sectionId: 'section-1',
  reminderTimes: ['08:00'],
  constantReminder: true,
  autoPopupLog: false,
};

const HABIT: Habit = {
  id: 'habit-1',
  name: 'Hydrate',
  reason: 'clear head',
  icon: 'water',
  frequency: 'weekly',
  weeklyCount: 5,
  startDate: '2026-08-01',
  goalDays: 21,
  goalType: 'quantity',
  targetAmount: 8,
  unit: 'Glasses',
  checkInMode: 'auto',
  recordIncrement: 1,
  sectionId: 'section-2',
  reminderTimes: ['09:00', '14:00'],
  constantReminder: true,
  autoPopupLog: true,
  active: true,
  position: 0,
  createdAt: 1754006400000,
};

describe('buildHabitDraft', () => {
  it('trims the name and drops a blank reason', () => {
    const draft = buildHabitDraft({ ...BASE, name: '  Walk  ', reason: '   ' });

    expect(draft.name).toBe('Walk');
    expect(draft.reason).toBeUndefined();
  });

  it('keeps a trimmed reason', () => {
    expect(buildHabitDraft({ ...BASE, reason: ' fresh air ' }).reason).toBe('fresh air');
  });

  it('keeps only the schedule field the frequency uses', () => {
    const weekly = buildHabitDraft({ ...BASE, frequency: 'weekly' });

    expect(weekly.weeklyCount).toBe(3);
    expect(weekly.weeklyDays).toBeUndefined();
    expect(weekly.intervalDays).toBeUndefined();
  });

  it('flattens the goal and carries the rest of the details', () => {
    const draft = buildHabitDraft({
      ...BASE,
      goal: { goalType: 'quantity', targetAmount: 8, unit: 'Glasses', checkInMode: 'manual' },
    });

    expect(draft).toMatchObject({
      icon: 'walk',
      goalType: 'quantity',
      targetAmount: 8,
      unit: 'Glasses',
      checkInMode: 'manual',
      startDate: '2026-08-26',
      goalDays: 30,
      sectionId: 'section-1',
      reminderTimes: ['08:00'],
      constantReminder: true,
      autoPopupLog: false,
    });
  });
});

describe('detailsStateFor', () => {
  it('starts a new habit daily on the default days in the default section', () => {
    const state = detailsStateFor(null, 'section-others');

    expect(state).toMatchObject({
      frequency: 'daily',
      weeklyCount: 1,
      intervalDays: 2,
      goal: { goalType: 'boolean', checkInMode: 'auto' },
      goalDays: undefined,
      sectionId: 'section-others',
      reminderTimes: [],
      constantReminder: false,
      autoPopupLog: false,
    });
    expect(state.weeklyDays.length).toBeGreaterThan(0);
  });

  it('round-trips an existing habit through buildHabitDraft', () => {
    const draft = buildHabitDraft({
      ...detailsStateFor(HABIT, 'section-others'),
      name: HABIT.name,
      reason: HABIT.reason ?? '',
      icon: 'water',
    });

    expect(draft).toStrictEqual({
      name: 'Hydrate',
      reason: 'clear head',
      icon: 'water',
      frequency: 'weekly',
      weeklyDays: undefined,
      weeklyCount: 5,
      intervalDays: undefined,
      startDate: '2026-08-01',
      goalDays: 21,
      goalType: 'quantity',
      targetAmount: 8,
      unit: 'Glasses',
      checkInMode: 'auto',
      recordIncrement: 1,
      sectionId: 'section-2',
      reminderTimes: ['09:00', '14:00'],
      constantReminder: true,
      autoPopupLog: true,
    });
  });
});

describe('scheduleErrorFor', () => {
  it('rejects a daily habit with no days', () => {
    expect(scheduleErrorFor({ ...BASE, weeklyDays: [] })).toBe(
      'Select at least one day for a daily habit.'
    );
  });

  it('accepts a daily habit with a day, and any other frequency without one', () => {
    expect(scheduleErrorFor(BASE)).toBeNull();
    expect(scheduleErrorFor({ ...BASE, frequency: 'weekly', weeklyDays: [] })).toBeNull();
    expect(scheduleErrorFor({ ...BASE, frequency: 'interval', weeklyDays: [] })).toBeNull();
  });
});

describe('describeGoal', () => {
  it('names a boolean goal', () => {
    expect(describeGoal({ goalType: 'boolean', checkInMode: 'auto' })).toBe('Achieve it all');
  });

  it('prints amount and unit for a quantity goal', () => {
    expect(
      describeGoal({ goalType: 'quantity', targetAmount: 8, unit: 'Glasses', checkInMode: 'auto' })
    ).toBe('8 Glasses');
  });

  it('falls back to one Count', () => {
    expect(describeGoal({ goalType: 'quantity', checkInMode: 'auto' })).toBe('1 Count');
  });
});
