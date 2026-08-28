import type { HabitSection } from '@habits-coach/shared';
import { getRoutineAlarmLabel } from '../utils/routineAlarmLabel';

function section(overrides: Partial<HabitSection> = {}): HabitSection {
  return {
    id: 'morning',
    name: 'Morning',
    sortOrder: 0,
    alarmEnabled: true,
    alarmByDay: {},
    ...overrides,
  };
}

/** 2026-08-24 is a Monday. */
const mondayAt = (hour: number, minute = 0) => new Date(2026, 7, 24, hour, minute);

describe('getRoutineAlarmLabel', () => {
  it('says No alarm when the routine has no week', () => {
    expect(getRoutineAlarmLabel(section(), mondayAt(5))).toEqual({
      text: 'No alarm',
      active: false,
    });
  });

  it('says Paused when the week is kept but the switch is off', () => {
    const label = getRoutineAlarmLabel(
      section({ alarmEnabled: false, alarmByDay: { Mon: '06:30' } }),
      mondayAt(5)
    );

    expect(label).toEqual({ text: 'Paused', active: false });
  });

  it("shows today's time while it is still ahead", () => {
    const label = getRoutineAlarmLabel(section({ alarmByDay: { Mon: '06:30' } }), mondayAt(5));

    expect(label).toEqual({ text: '6:30 AM', active: true });
  });

  it('rolls past a time that has already gone', () => {
    const label = getRoutineAlarmLabel(
      section({ alarmByDay: { Mon: '06:30', Tue: '07:15' } }),
      mondayAt(9)
    );

    expect(label.text).toBe('7:15 AM');
  });

  it('wraps to the same day next week when it is the only one', () => {
    const label = getRoutineAlarmLabel(section({ alarmByDay: { Mon: '06:30' } }), mondayAt(9));

    expect(label).toEqual({ text: '6:30 AM', active: true });
  });

  it('finds the next day later in the week', () => {
    const label = getRoutineAlarmLabel(
      section({ alarmByDay: { Wed: '08:00', Sat: '09:45' } }),
      mondayAt(6)
    );

    expect(label.text).toBe('8:00 AM');
  });
});
