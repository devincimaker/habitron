import type { Habit, HabitSection } from '@habits-coach/shared';
import {
  applyHabitOrder,
  buildHabitRows,
  resolveOrderFromRows,
  sortHabitsByPosition,
  type HabitRow,
} from '../utils/habitOrder';

function habit(id: string, sectionId: string | undefined, position: number, createdAt = 0): Habit {
  return {
    id,
    name: id,
    frequency: 'daily',
    startDate: '2026-04-01',
    goalType: 'boolean',
    checkInMode: 'auto',
    reminderTimes: [],
    constantReminder: false,
    active: true,
    sectionId,
    position,
    createdAt,
  };
}

const morning: HabitSection = { id: 'morning', name: 'Morning', sortOrder: 0 };
const afternoon: HabitSection = { id: 'afternoon', name: 'Afternoon', sortOrder: 1 };
const sections = [morning, afternoon];

/** The flat row array the screen renders, as ids, for readable assertions. */
function keys(rows: HabitRow<Habit>[]): string[] {
  return rows.map((row) => row.key);
}

describe('sortHabitsByPosition', () => {
  it('orders by position regardless of input order', () => {
    const sorted = sortHabitsByPosition([
      habit('c', 'morning', 2),
      habit('a', 'morning', 0),
      habit('b', 'morning', 1),
    ]);
    expect(sorted.map((h) => h.id)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to createdAt when positions tie', () => {
    const sorted = sortHabitsByPosition([
      habit('later', 'morning', 0, 200),
      habit('earlier', 'morning', 0, 100),
    ]);
    expect(sorted.map((h) => h.id)).toEqual(['earlier', 'later']);
  });

  it('does not mutate its input', () => {
    const input = [habit('b', 'morning', 1), habit('a', 'morning', 0)];
    sortHabitsByPosition(input);
    expect(input.map((h) => h.id)).toEqual(['b', 'a']);
  });
});

describe('buildHabitRows', () => {
  it('emits every section in order, habits sorted within each', () => {
    const rows = buildHabitRows(sections, [
      habit('m2', 'morning', 1),
      habit('a1', 'afternoon', 0),
      habit('m1', 'morning', 0),
    ]);
    expect(keys(rows)).toEqual([
      'header:morning',
      'm1',
      'm2',
      'header:afternoon',
      'a1',
      'header:none',
      'placeholder:none',
    ]);
  });

  it('keeps empty routines in the data, marked to hide at rest', () => {
    const rows = buildHabitRows(sections, [habit('m1', 'morning', 0)]);
    const afternoonHeader = rows.find((row) => row.key === 'header:afternoon');
    const morningHeader = rows.find((row) => row.key === 'header:morning');

    expect(afternoonHeader).toMatchObject({ type: 'header', idleHidden: true });
    expect(morningHeader).toMatchObject({ type: 'header', idleHidden: false });
    // The placeholder is what makes an empty routine a hittable drop target.
    expect(keys(rows)).toContain('placeholder:afternoon');
  });

  it('puts habits with no routine, and with a dangling one, in the trailing bucket', () => {
    const rows = buildHabitRows(sections, [
      habit('none', undefined, 0),
      habit('gone', 'deleted-section', 1),
    ]);
    const trailing = keys(rows).slice(keys(rows).indexOf('header:none'));
    expect(trailing).toEqual(['header:none', 'none', 'gone']);
  });
});

describe('resolveOrderFromRows', () => {
  it('renumbers densely after a move inside one routine', () => {
    const rows = buildHabitRows(sections, [
      habit('a', 'morning', 0),
      habit('b', 'morning', 1),
      habit('c', 'morning', 2),
    ]);
    // Drag 'c' to the top of its own routine.
    const moved = [rows[0], rows[3], rows[1], rows[2], ...rows.slice(4)] as HabitRow<Habit>[];

    expect(resolveOrderFromRows(moved)).toEqual([
      { id: 'c', sectionId: 'morning', position: 0 },
      { id: 'a', sectionId: 'morning', position: 1 },
      { id: 'b', sectionId: 'morning', position: 2 },
    ]);
  });

  it('takes the new routine and renumbers both sides on a cross-routine move', () => {
    const rows = buildHabitRows(sections, [
      habit('m1', 'morning', 0),
      habit('m2', 'morning', 1),
      habit('a1', 'afternoon', 0),
    ]);
    // Drag 'm1' down past the Afternoon header, landing above 'a1'.
    const moved = [
      rows[0], // header:morning
      rows[2], // m2
      rows[3], // header:afternoon
      rows[1], // m1
      rows[4], // a1
      ...rows.slice(5),
    ] as HabitRow<Habit>[];

    expect(resolveOrderFromRows(moved)).toEqual([
      // Source renumbers...
      { id: 'm2', sectionId: 'morning', position: 0 },
      // ...the moved habit takes the destination routine...
      { id: 'm1', sectionId: 'afternoon', position: 0 },
      // ...and the destination renumbers behind it.
      { id: 'a1', sectionId: 'afternoon', position: 1 },
    ]);
  });

  it('clamps a habit dragged above the first header into the first routine', () => {
    const rows = buildHabitRows(sections, [
      habit('m1', 'morning', 0),
      habit('a1', 'afternoon', 0),
    ]);
    // 'a1' dragged to the very top, above header:morning.
    const moved = [rows[3], ...rows.slice(0, 3), ...rows.slice(4)] as HabitRow<Habit>[];

    expect(resolveOrderFromRows(moved)).toEqual([
      { id: 'a1', sectionId: 'morning', position: 0 },
      { id: 'm1', sectionId: 'morning', position: 1 },
    ]);
  });

  it('returns nothing when the drop changes no order', () => {
    const rows = buildHabitRows(sections, [
      habit('a', 'morning', 0),
      habit('b', 'morning', 1),
    ]);
    expect(resolveOrderFromRows(rows)).toEqual([]);
  });

  it('resolves a drop into an empty routine through its placeholder', () => {
    const rows = buildHabitRows(sections, [habit('m1', 'morning', 0)]);
    // rows: header:morning, m1, header:afternoon, placeholder:afternoon, header:none, placeholder:none
    const moved = [rows[0], rows[2], rows[1], ...rows.slice(3)] as HabitRow<Habit>[];

    expect(resolveOrderFromRows(moved)).toEqual([
      { id: 'm1', sectionId: 'afternoon', position: 0 },
    ]);
  });
});

describe('applyHabitOrder', () => {
  it('applies sectionId and position, leaving everything else alone', () => {
    const habits = [habit('a', 'morning', 0), habit('b', 'morning', 1)];
    const applied = applyHabitOrder(habits, [
      { id: 'b', sectionId: 'afternoon', position: 0 },
    ]);

    expect(applied[1]).toMatchObject({ id: 'b', sectionId: 'afternoon', position: 0, name: 'b' });
    expect(applied[0]).toBe(habits[0]);
  });

  it('maps a null routine back to undefined, which is what Habit carries', () => {
    const applied = applyHabitOrder(
      [habit('a', 'morning', 0)],
      [{ id: 'a', sectionId: null, position: 0 }]
    );
    expect(applied[0].sectionId).toBeUndefined();
  });

  it('returns the same array when there is nothing to apply', () => {
    const habits = [habit('a', 'morning', 0)];
    expect(applyHabitOrder(habits, [])).toBe(habits);
  });
});
