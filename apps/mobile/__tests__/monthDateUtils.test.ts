import {
  getFirstDateOfMonth,
  getMonthSelectionTarget,
  getWeekDaysStartingSunday,
  getMonthGridDates,
  getWeekRowIndex,
  getMonthInfo,
  getMonthDisplayString,
  getPreviousMonth,
  getNextMonth,
  isMonthAfterOrEqual,
  getDateFromTimestamp,
} from '../utils/dateUtils';

describe('getMonthInfo', () => {
  it('returns correct days in month for January 2026', () => {
    const info = getMonthInfo(2026, 0);
    expect(info.daysInMonth).toBe(31);
    expect(info.startDate).toBe('2026-01-01');
    expect(info.endDate).toBe('2026-01-31');
  });

  it('returns correct first day of week for January 2026 (Thursday)', () => {
    const info = getMonthInfo(2026, 0);
    expect(info.firstDayOfWeek).toBe(4); // Thursday
  });

  it('handles February in leap year (2024)', () => {
    const info = getMonthInfo(2024, 1);
    expect(info.daysInMonth).toBe(29);
    expect(info.startDate).toBe('2024-02-01');
    expect(info.endDate).toBe('2024-02-29');
  });

  it('handles February in non-leap year (2025)', () => {
    const info = getMonthInfo(2025, 1);
    expect(info.daysInMonth).toBe(28);
    expect(info.startDate).toBe('2025-02-01');
    expect(info.endDate).toBe('2025-02-28');
  });

  it('handles December correctly', () => {
    const info = getMonthInfo(2026, 11);
    expect(info.daysInMonth).toBe(31);
    expect(info.month).toBe(11);
    expect(info.year).toBe(2026);
    expect(info.startDate).toBe('2026-12-01');
    expect(info.endDate).toBe('2026-12-31');
  });

  it('handles months with 30 days', () => {
    const info = getMonthInfo(2026, 3); // April
    expect(info.daysInMonth).toBe(30);
    expect(info.endDate).toBe('2026-04-30');
  });
});

describe('getMonthDisplayString', () => {
  it('formats January 2026 correctly', () => {
    expect(getMonthDisplayString(2026, 0)).toBe('January 2026');
  });

  it('formats December 2026 correctly', () => {
    expect(getMonthDisplayString(2026, 11)).toBe('December 2026');
  });

  it('formats February 2025 correctly', () => {
    expect(getMonthDisplayString(2025, 1)).toBe('February 2025');
  });
});

describe('getPreviousMonth', () => {
  it('handles normal month (July -> June)', () => {
    expect(getPreviousMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });

  it('handles year boundary (January -> December)', () => {
    expect(getPreviousMonth(2026, 0)).toEqual({ year: 2025, month: 11 });
  });

  it('handles February -> January', () => {
    expect(getPreviousMonth(2026, 1)).toEqual({ year: 2026, month: 0 });
  });
});

describe('getNextMonth', () => {
  it('handles normal month (June -> July)', () => {
    expect(getNextMonth(2026, 5)).toEqual({ year: 2026, month: 6 });
  });

  it('handles year boundary (December -> January)', () => {
    expect(getNextMonth(2025, 11)).toEqual({ year: 2026, month: 0 });
  });

  it('handles January -> February', () => {
    expect(getNextMonth(2026, 0)).toEqual({ year: 2026, month: 1 });
  });
});

describe('isMonthAfterOrEqual', () => {
  it('returns true for same month and year', () => {
    expect(isMonthAfterOrEqual(2026, 1, 2026, 1)).toBe(true);
  });

  it('returns true for later month in same year', () => {
    expect(isMonthAfterOrEqual(2026, 6, 2026, 1)).toBe(true);
  });

  it('returns true for later year', () => {
    expect(isMonthAfterOrEqual(2027, 0, 2026, 11)).toBe(true);
  });

  it('returns false for earlier month in same year', () => {
    expect(isMonthAfterOrEqual(2026, 0, 2026, 6)).toBe(false);
  });

  it('returns false for earlier year', () => {
    expect(isMonthAfterOrEqual(2025, 11, 2026, 0)).toBe(false);
  });

  it('returns true when month A equals month B', () => {
    expect(isMonthAfterOrEqual(2026, 5, 2026, 5)).toBe(true);
  });
});

describe('getDateFromTimestamp', () => {
  it('extracts correct date components', () => {
    const timestamp = new Date('2026-01-15T12:00:00').getTime();
    const result = getDateFromTimestamp(timestamp);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(0); // January is 0
    expect(result.day).toBe(15);
  });

  it('handles year boundary', () => {
    const timestamp = new Date('2025-12-31T23:59:59').getTime();
    const result = getDateFromTimestamp(timestamp);
    expect(result.year).toBe(2025);
    expect(result.month).toBe(11); // December is 11
    expect(result.day).toBe(31);
  });

  it('handles first day of year', () => {
    const timestamp = new Date('2026-01-01T00:00:00').getTime();
    const result = getDateFromTimestamp(timestamp);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(0);
    expect(result.day).toBe(1);
  });
});

describe('getWeekDaysStartingSunday', () => {
  it('returns the Sunday-to-Saturday week containing the selected date', () => {
    const days = getWeekDaysStartingSunday('2026-04-15');

    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe('2026-04-12');
    expect(days[3]?.date).toBe('2026-04-15');
    expect(days[6]?.date).toBe('2026-04-18');
  });

  it('crosses month boundaries correctly', () => {
    const days = getWeekDaysStartingSunday('2026-05-01');

    expect(days[0]?.date).toBe('2026-04-26');
    expect(days[5]?.date).toBe('2026-05-01');
    expect(days[6]?.date).toBe('2026-05-02');
  });
});

describe('getWeekRowIndex', () => {
  it('returns the correct row for the first week in a month', () => {
    expect(getWeekRowIndex(2026, 3, 1)).toBe(0);
    expect(getWeekRowIndex(2026, 3, 4)).toBe(0);
  });

  it('returns the correct row for later weeks in a month', () => {
    expect(getWeekRowIndex(2026, 3, 12)).toBe(2);
    expect(getWeekRowIndex(2026, 3, 30)).toBe(4);
  });
});

describe('getMonthGridDates', () => {
  it('always returns six full Sunday-to-Saturday weeks', () => {
    const weeks = getMonthGridDates(2026, 3);

    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[5]).toHaveLength(7);
    expect(weeks[0]?.[0]).toBe('2026-03-29');
    expect(weeks[5]?.[6]).toBe('2026-05-09');
  });

  it('pads short months with next-month dates', () => {
    const weeks = getMonthGridDates(2026, 1);

    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[0]).toBe('2026-02-01');
    expect(weeks[4]?.[6]).toBe('2026-03-07');
    expect(weeks[5]?.[0]).toBe('2026-03-08');
    expect(weeks[5]?.[6]).toBe('2026-03-14');
  });
});

describe('getFirstDateOfMonth', () => {
  it('returns the first day string for a given month', () => {
    expect(getFirstDateOfMonth(2026, 4)).toBe('2026-05-01');
    expect(getFirstDateOfMonth(2025, 11)).toBe('2025-12-01');
  });
});

describe('getMonthSelectionTarget', () => {
  it('returns today when navigating to the real current month', () => {
    expect(getMonthSelectionTarget(2026, 3, '2026-04-12')).toBe('2026-04-12');
  });

  it('returns the first day for non-current months', () => {
    expect(getMonthSelectionTarget(2026, 4, '2026-04-12')).toBe('2026-05-01');
    expect(getMonthSelectionTarget(2025, 11, '2026-04-12')).toBe('2025-12-01');
  });
});
