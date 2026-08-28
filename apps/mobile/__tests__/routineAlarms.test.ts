import type { Habit, HabitSection } from '@habits-coach/shared';
import { planRoutineAlarms } from '../services/routineAlarms';

// 2026-08-24 is a Monday, so "today" sits at the start of a week and the
// weekday arithmetic below reads without a calendar.
const MONDAY = '2026-08-24';
/** 05:00 that Monday — before every alarm time below, so today is always still ahead. */
const MONDAY_EARLY = new Date('2026-08-24T05:00:00');

function section(overrides: Partial<HabitSection> = {}): HabitSection {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Morning',
    sortOrder: 0,
    alarmEnabled: true,
    alarmByDay: {},
    ...overrides,
  };
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Meditate',
    frequency: 'daily',
    startDate: '2026-01-01',
    goalType: 'boolean',
    checkInMode: 'manual',
    reminderTimes: [],
    constantReminder: false,
    active: true,
    position: 0,
    createdAt: 0,
    sectionId: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  };
}

describe('planRoutineAlarms', () => {
  it('groups the week into one alarm per distinct time', () => {
    const alarms = planRoutineAlarms(
      [
        section({
          alarmByDay: {
            Mon: '06:30',
            Tue: '06:30',
            Wed: '06:30',
            Thu: '06:30',
            Fri: '06:30',
            Sat: '08:00',
            Sun: '08:00',
          },
        }),
      ],
      [habit()],
      MONDAY_EARLY
    );

    expect(alarms).toHaveLength(2);

    const [early, late] = alarms;
    expect(early.hour).toBe(6);
    expect(early.minute).toBe(30);
    expect(early.weekdays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

    expect(late.hour).toBe(8);
    expect(late.minute).toBe(0);
    expect(late.weekdays).toEqual(['Sun', 'Sat']);

    // Two times on one routine must not collide on the same alarm.
    expect(early.id).not.toBe(late.id);
  });

  it('plans nothing for a routine whose alarm is paused', () => {
    const alarms = planRoutineAlarms(
      [section({ alarmEnabled: false, alarmByDay: { Mon: '06:30' } })],
      [habit()],
      MONDAY_EARLY
    );

    expect(alarms).toEqual([]);
  });

  it('plans nothing for a routine with no alarm rows', () => {
    expect(planRoutineAlarms([section()], [habit()], MONDAY_EARLY)).toEqual([]);
  });

  it('titles the alarm with the first due habit by position', () => {
    const alarms = planRoutineAlarms(
      [section({ alarmByDay: { Mon: '06:30' } })],
      [
        habit({ id: 'b', name: 'Stretch', position: 1 }),
        habit({ id: 'a', name: 'Meditate', position: 0 }),
      ],
      MONDAY_EARLY
    );

    expect(alarms[0].title).toBe('Morning · Meditate first');
  });

  it('falls back to the routine name when nothing is due that day', () => {
    const alarms = planRoutineAlarms(
      [section({ alarmByDay: { Mon: '06:30' } })],
      [habit({ frequency: 'daily', weeklyDays: ['Sun'] })],
      MONDAY_EARLY
    );

    expect(alarms[0].title).toBe('Morning');
  });

  it('skips an interval habit that is not due on the next fire date', () => {
    // Starts on the Monday and repeats every third day, so it is due on the
    // Monday but not on the Tuesday the alarm actually rings.
    const alarms = planRoutineAlarms(
      [section({ alarmByDay: { Tue: '06:30' } })],
      [habit({ frequency: 'interval', intervalDays: 3, startDate: MONDAY })],
      MONDAY_EARLY
    );

    expect(alarms[0].title).toBe('Morning');
  });

  it('titles from the next fire date, not from today', () => {
    // Rings on Saturday; the habit is due on Saturdays only, so a planner that
    // asked "is it due today (Monday)?" would drop the name.
    const alarms = planRoutineAlarms(
      [section({ alarmByDay: { Sat: '08:00' } })],
      [habit({ frequency: 'daily', weeklyDays: ['Sat'] })],
      MONDAY_EARLY
    );

    expect(alarms[0].title).toBe('Morning · Meditate first');
  });

  it('ignores habits belonging to another routine', () => {
    const alarms = planRoutineAlarms(
      [section({ alarmByDay: { Mon: '06:30' } })],
      [habit({ sectionId: 'someone-else', name: 'Stretch' })],
      MONDAY_EARLY
    );

    expect(alarms[0].title).toBe('Morning');
  });

  it('rolls past today once its own ring has gone', () => {
    // 07:00 on the Monday, so Monday's 06:30 has already rung: the alarm next
    // fires on the Tuesday, and the title has to come from that day.
    const alarms = planRoutineAlarms(
      [section({ alarmByDay: { Mon: '06:30', Tue: '06:30' } })],
      [habit({ frequency: 'daily', weeklyDays: ['Tue'] })],
      new Date('2026-08-24T07:00:00')
    );

    expect(alarms[0].title).toBe('Morning · Meditate first');
  });

  it('gives every routine its own alarm', () => {
    const alarms = planRoutineAlarms(
      [
        section({ alarmByDay: { Mon: '06:30' } }),
        section({
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Night',
          alarmByDay: { Mon: '21:00' },
        }),
      ],
      [habit()],
      MONDAY_EARLY
    );

    expect(alarms.map((alarm) => alarm.title)).toEqual([
      'Morning · Meditate first',
      'Night',
    ]);
    expect(new Set(alarms.map((alarm) => alarm.id)).size).toBe(2);
  });
});
