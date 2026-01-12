import {
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
