import {
  buildTaskCalendarMonthWeeks,
  getTaskCalendarDateAtPosition,
  getTaskCalendarHeights,
  getTaskCalendarNavigationTarget,
  type TaskCalendarMetrics,
} from '../utils/taskCalendar';

const metrics: TaskCalendarMetrics = {
  topPadding: 8,
  bottomPadding: 4,
  weekdayRowHeight: 20,
  rowHeight: 44,
};

describe('buildTaskCalendarMonthWeeks', () => {
  it('builds a six-week month grid with adjacent-month cells', () => {
    const weeks = buildTaskCalendarMonthWeeks(2026, 3);

    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[0]).toEqual({
      dateStr: '2026-03-29',
      day: 29,
      isCurrentMonth: false,
    });
    expect(weeks[0]?.[3]).toEqual({
      dateStr: '2026-04-01',
      day: 1,
      isCurrentMonth: true,
    });
    expect(weeks[5]?.[6]).toEqual({
      dateStr: '2026-05-09',
      day: 9,
      isCurrentMonth: false,
    });
  });
});

describe('getTaskCalendarHeights', () => {
  it('returns collapsed and expanded heights from shared metrics', () => {
    expect(getTaskCalendarHeights(6, metrics)).toEqual({
      expandedHeight: 296,
      collapsedHeight: 76,
    });
  });
});

describe('getTaskCalendarDateAtPosition', () => {
  const frame = { x: 10, y: 20, width: 350, height: 296 };
  const weekDates = [
    '2026-04-12',
    '2026-04-13',
    '2026-04-14',
    '2026-04-15',
    '2026-04-16',
    '2026-04-17',
    '2026-04-18',
  ];
  const expandedWeeks = buildTaskCalendarMonthWeeks(2026, 3);

  it('maps a collapsed hit to the correct week date', () => {
    expect(
      getTaskCalendarDateAtPosition({
        frame,
        screenX: 90,
        screenY: 80,
        isExpanded: false,
        weekDates,
        expandedWeeks,
        metrics,
      })
    ).toBe('2026-04-13');
  });

  it('maps an expanded hit to the correct month cell', () => {
    expect(
      getTaskCalendarDateAtPosition({
        frame,
        screenX: 190,
        screenY: 154,
        isExpanded: true,
        weekDates,
        expandedWeeks,
        metrics,
      })
    ).toBe('2026-04-15');
  });

  it('returns null for points outside the calendar frame', () => {
    expect(
      getTaskCalendarDateAtPosition({
        frame,
        screenX: 5,
        screenY: 5,
        isExpanded: false,
        weekDates,
        expandedWeeks,
        metrics,
      })
    ).toBeNull();
  });
});

describe('getTaskCalendarNavigationTarget', () => {
  it('uses today when navigating into the real current month', () => {
    expect(getTaskCalendarNavigationTarget(2026, 4, 'previous', '2026-04-12')).toEqual({
      year: 2026,
      month: 3,
      dateStr: '2026-04-12',
    });
  });

  it('uses day one for non-current month navigation', () => {
    expect(getTaskCalendarNavigationTarget(2026, 3, 'next', '2026-04-12')).toEqual({
      year: 2026,
      month: 4,
      dateStr: '2026-05-01',
    });
  });
});
