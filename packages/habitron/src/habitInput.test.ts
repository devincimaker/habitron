import { describe, expect, it } from 'vitest';
import { HabitFieldConflict, habitRowFromInput, type ExistingHabitMode } from './habitInput.js';

const TODAY = '2026-08-25';
const create = (input: Parameters<typeof habitRowFromInput>[0], sectionId?: string | null) =>
  habitRowFromInput(input, { today: TODAY, ...(sectionId !== undefined ? { sectionId } : {}) });

const BOOLEAN_DAILY: ExistingHabitMode = {
  frequency: 'daily',
  goalType: 'boolean',
  checkInMode: 'auto',
};
const update = (
  input: Parameters<typeof habitRowFromInput>[0],
  existing: ExistingHabitMode = BOOLEAN_DAILY
) => habitRowFromInput(input, { today: TODAY, existing });

describe('create', () => {
  it('fills every column, defaulting to a boolean daily habit starting today', () => {
    expect(create({ name: '  Push-ups  ' })).toEqual({
      name: 'Push-ups',
      frequency: 'daily',
      weekly_days: null,
      weekly_count: null,
      interval_days: null,
      goal_type: 'boolean',
      target_amount: null,
      unit: null,
      check_in_mode: 'auto',
      record_increment: null,
      start_date: TODAY,
      goal_days: null,
      reason: null,
      icon: null,
      constant_reminder: false,
      section_id: null,
    });
  });

  it('pins weekdays on daily, which is where the app puts them', () => {
    const row = create({ name: 'Gym', frequency: 'daily', weeklyDays: ['Mon', 'Wed', 'Fri'] });
    expect(row.weekly_days).toEqual(['Mon', 'Wed', 'Fri']);
    expect(row.weekly_count).toBeNull();
    expect(row.interval_days).toBeNull();
  });

  it('defaults weeklyCount to 1 and nulls the other frequency columns', () => {
    const row = create({ name: 'Long run', frequency: 'weekly' });
    expect(row).toMatchObject({ frequency: 'weekly', weekly_count: 1, weekly_days: null, interval_days: null });
  });

  it('defaults intervalDays to 2', () => {
    expect(create({ name: 'Stretch', frequency: 'interval' })).toMatchObject({
      interval_days: 2,
      weekly_days: null,
      weekly_count: null,
    });
  });

  it('defaults a quantity goal to 1 Count, auto, increment 1', () => {
    expect(create({ name: 'Water', goalType: 'quantity' })).toMatchObject({
      goal_type: 'quantity',
      target_amount: 1,
      unit: 'Count',
      check_in_mode: 'auto',
      record_increment: 1,
    });
  });

  it('drops the increment when a quantity habit is checked in by hand', () => {
    expect(create({ name: 'Water', goalType: 'quantity', checkInMode: 'manual' })).toMatchObject({
      check_in_mode: 'manual',
      record_increment: null,
    });
  });

  it('carries the optional columns through', () => {
    expect(
      create({
        name: 'Read',
        goalDays: 30,
        reason: 'Sleep better',
        icon: 'book',
        constantReminder: true,
      })
    ).toMatchObject({
      goal_days: 30,
      reason: 'Sleep better',
      icon: 'book',
      constant_reminder: true,
    });
  });

  it('takes the resolved section id, and leaves it null when none was given', () => {
    expect(create({ name: 'Meditate' }, 'section-1').section_id).toBe('section-1');
    expect(create({ name: 'Meditate' }).section_id).toBeNull();
  });

  it('honours an explicit start date over today', () => {
    expect(create({ name: 'Meditate', startDate: '2026-09-01' }).start_date).toBe('2026-09-01');
  });
});

describe('rejections', () => {
  it('needs a name, and will not take whitespace for one', () => {
    expect(() => create({})).toThrow(HabitFieldConflict);
    expect(() => create({ name: '   ' })).toThrow(/name is required/);
  });

  it('names the conflict when a field belongs to another frequency', () => {
    expect(() => create({ name: 'x', frequency: 'daily', weeklyCount: 3 })).toThrow(
      /weeklyCount only applies to weekly habits, and this habit is daily/
    );
    expect(() => create({ name: 'x', frequency: 'weekly', weeklyDays: ['Mon'] })).toThrow(
      /weeklyDays only applies to daily habits, and this habit is weekly/
    );
    expect(() => create({ name: 'x', frequency: 'interval', weeklyCount: 2 })).toThrow(
      /weeklyCount only applies to weekly habits, and this habit is interval/
    );
  });

  it('names the conflict when a quantity field is set on a boolean habit', () => {
    expect(() => create({ name: 'x', targetAmount: 8 })).toThrow(
      /targetAmount only applies to quantity habits, and this habit is boolean/
    );
    expect(() => create({ name: 'x', unit: 'glasses' })).toThrow(/unit only applies to quantity/);
    expect(() => create({ name: 'x', checkInMode: 'manual' })).toThrow(
      /checkInMode only applies to quantity/
    );
  });

  it('rejects an increment that no check-in mode would use', () => {
    expect(() =>
      create({ name: 'x', goalType: 'quantity', checkInMode: 'manual', recordIncrement: 2 })
    ).toThrow(/recordIncrement only applies to quantity habits with checkInMode 'auto'/);
  });

  it('will not switch to interval or quantity without the field that has no sane default', () => {
    expect(() => update({ frequency: 'interval' })).toThrow(/needs intervalDays/);
    expect(() => update({ goalType: 'quantity' })).toThrow(/needs targetAmount/);
  });
});

describe('update', () => {
  it('writes only what the patch names', () => {
    expect(update({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
    expect(update({ reason: 'Because' })).toEqual({ reason: 'Because' });
    expect(update({})).toEqual({});
  });

  it('leaves the mode alone when the patch is silent about it', () => {
    const row = update({ goalDays: 60 });
    expect(row).toEqual({ goal_days: 60 });
    expect(row).not.toHaveProperty('frequency');
    expect(row).not.toHaveProperty('goal_type');
  });

  it('clears the old frequency columns when the frequency changes', () => {
    const row = habitRowFromInput(
      { frequency: 'interval', intervalDays: 3 },
      { today: TODAY, existing: { frequency: 'weekly', goalType: 'boolean', checkInMode: 'auto' } }
    );
    expect(row).toMatchObject({
      frequency: 'interval',
      interval_days: 3,
      weekly_count: null,
      weekly_days: null,
    });
  });

  it('clears the quantity columns when a habit drops back to boolean', () => {
    const row = habitRowFromInput(
      { goalType: 'boolean' },
      { today: TODAY, existing: { frequency: 'daily', goalType: 'quantity', checkInMode: 'manual' } }
    );
    expect(row).toMatchObject({
      goal_type: 'boolean',
      target_amount: null,
      unit: null,
      check_in_mode: 'auto',
      record_increment: null,
    });
  });

  it('checks a lone field against the habit’s existing mode, not the default', () => {
    const quantity: ExistingHabitMode = {
      frequency: 'daily',
      goalType: 'quantity',
      checkInMode: 'auto',
    };
    // Legal here precisely because the habit already is a quantity habit.
    expect(update({ targetAmount: 8 }, quantity)).toEqual({ target_amount: 8 });
    // And still illegal on a boolean one.
    expect(() => update({ targetAmount: 8 })).toThrow(/only applies to quantity/);
  });

  it('recomputes the increment when the check-in mode moves off auto', () => {
    const quantity: ExistingHabitMode = {
      frequency: 'daily',
      goalType: 'quantity',
      checkInMode: 'auto',
    };
    expect(update({ checkInMode: 'manual' }, quantity)).toEqual({
      check_in_mode: 'manual',
      record_increment: null,
    });
    expect(update({ checkInMode: 'auto', recordIncrement: 5 }, quantity)).toEqual({
      check_in_mode: 'auto',
      record_increment: 5,
    });
  });

  it('sets the section only when one was resolved', () => {
    expect(habitRowFromInput({}, { today: TODAY, existing: BOOLEAN_DAILY })).not.toHaveProperty(
      'section_id'
    );
    expect(
      habitRowFromInput({}, { today: TODAY, existing: BOOLEAN_DAILY, sectionId: 'section-2' })
    ).toEqual({ section_id: 'section-2' });
    expect(
      habitRowFromInput({}, { today: TODAY, existing: BOOLEAN_DAILY, sectionId: null })
    ).toEqual({ section_id: null });
  });
});
