import { describe, expect, it, vi, afterEach } from 'vitest';
import { addDays, isIsoDate, localNow, today, weekRange, weekdayOf } from './time.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('isIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isIsoDate('2026-08-24')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects other shapes and impossible dates', () => {
    expect(isIsoDate('24-08-2026')).toBe(false);
    expect(isIsoDate('2026-8-4')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('weekdayOf', () => {
  it('uses the calendar date regardless of host timezone', () => {
    expect(weekdayOf('2026-08-24')).toBe('Mon');
    expect(weekdayOf('2026-08-23')).toBe('Sun');
    expect(weekdayOf('2026-08-29')).toBe('Sat');
  });
});

describe('addDays', () => {
  it('moves forward and backward across month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-08-24', 0)).toBe('2026-08-24');
  });
});

describe('weekRange', () => {
  it('returns the Sunday-based week containing the date', () => {
    expect(weekRange('2026-08-24')).toEqual({ start: '2026-08-23', end: '2026-08-29' });
    expect(weekRange('2026-08-23')).toEqual({ start: '2026-08-23', end: '2026-08-29' });
    expect(weekRange('2026-08-29')).toEqual({ start: '2026-08-23', end: '2026-08-29' });
  });
});

describe('localNow', () => {
  it('reports the wall clock of the given timezone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T23:30:00Z'));

    expect(localNow('UTC')).toEqual({ date: '2026-08-24', time: '23:30', weekday: 'Mon' });
    // Already the next day in Madrid (UTC+2 in August).
    expect(localNow('Europe/Madrid')).toEqual({ date: '2026-08-25', time: '01:30', weekday: 'Tue' });
    expect(today('America/Los_Angeles')).toBe('2026-08-24');
  });

  it('normalises midnight to 00 rather than 24', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T22:05:00Z'));

    expect(localNow('Europe/Madrid').time).toBe('00:05');
  });
});
