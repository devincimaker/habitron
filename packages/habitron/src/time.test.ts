import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  addDays,
  instantFrom,
  isIsoDate,
  isIsoDateTime,
  localDateOf,
  localNow,
  today,
  weekRange,
  weekdayOf,
} from './time.js';

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

describe('isIsoDateTime', () => {
  it('accepts a local wall clock', () => {
    expect(isIsoDateTime('2026-08-25T07:15')).toBe(true);
    expect(isIsoDateTime('2026-08-25T00:00')).toBe(true);
    expect(isIsoDateTime('2026-08-25T23:59')).toBe(true);
  });

  it('tolerates seconds, which models emit unprompted', () => {
    // Measured: the first create_task of a real log turn sent
    // '2026-08-25T07:00:00' and was rejected, costing a round trip.
    expect(isIsoDateTime('2026-08-25T07:15:00')).toBe(true);
    expect(isIsoDateTime('2026-08-25T07:15:42')).toBe(true);
    expect(isIsoDateTime('2026-08-25T07:15:60')).toBe(false);
  });

  it('rejects a space separator, a zone, and impossible clock times', () => {
    expect(isIsoDateTime('2026-08-25 07:15')).toBe(false);
    expect(isIsoDateTime('2026-08-25T07:15Z')).toBe(false);
    expect(isIsoDateTime('2026-08-25T24:00')).toBe(false);
    expect(isIsoDateTime('2026-08-25T07:60')).toBe(false);
    expect(isIsoDateTime('2026-08-25')).toBe(false);
  });
});

describe('instantFrom', () => {
  it('reads a wall clock in its zone, on both sides of DST', () => {
    // Paris is UTC+2 in August (CEST) and UTC+1 in January (CET).
    expect(instantFrom('2026-08-25T07:15', 'Europe/Paris')).toBe('2026-08-25T05:15:00.000Z');
    expect(instantFrom('2026-01-25T07:15', 'Europe/Paris')).toBe('2026-01-25T06:15:00.000Z');
  });

  it('is the identity in UTC', () => {
    expect(instantFrom('2026-08-25T07:15', 'UTC')).toBe('2026-08-25T07:15:00.000Z');
  });

  it('truncates seconds to the minute rather than rejecting them', () => {
    expect(instantFrom('2026-08-25T07:15:42', 'Europe/Paris')).toBe('2026-08-25T05:15:00.000Z');
    expect(instantFrom('2026-08-25T07:15:00', 'Europe/Paris')).toBe(
      instantFrom('2026-08-25T07:15', 'Europe/Paris')
    );
  });

  it('handles a zone behind UTC, and one on a half-hour offset', () => {
    expect(instantFrom('2026-08-25T07:15', 'America/New_York')).toBe('2026-08-25T11:15:00.000Z');
    expect(instantFrom('2026-08-25T07:15', 'Asia/Kolkata')).toBe('2026-08-25T01:45:00.000Z');
  });

  it('round-trips through localDateOf across a day boundary', () => {
    // 00:30 local in Paris is the previous day in UTC — the case the old
    // .slice(0, 10) got wrong, in the direction that loses a day.
    const instant = instantFrom('2026-08-25T00:30', 'Europe/Paris');
    expect(instant).toBe('2026-08-24T22:30:00.000Z');
    expect(localDateOf(instant, 'Europe/Paris')).toBe('2026-08-25');
  });

  it('resolves the hour that DST skips forward into', () => {
    // 02:30 does not exist in Paris on 2026-03-29; the two-pass conversion
    // settles rather than drifting, and stays inside that morning.
    const instant = instantFrom('2026-03-29T02:30', 'Europe/Paris');
    expect(localDateOf(instant, 'Europe/Paris')).toBe('2026-03-29');
  });
});

describe('localDateOf', () => {
  it('uses the local day, not the UTC one', () => {
    expect(localDateOf('2026-08-24T22:30:00.000Z', 'Europe/Paris')).toBe('2026-08-25');
    expect(localDateOf('2026-08-25T03:30:00.000Z', 'America/New_York')).toBe('2026-08-24');
  });

  it('matches the old UTC slice for a UTC user, so the correction is a no-op there', () => {
    for (const instant of [
      '2026-08-24T22:30:00.000Z',
      '2026-08-25T00:00:00.000Z',
      '2026-01-01T23:59:59.000Z',
    ]) {
      expect(localDateOf(instant, 'UTC')).toBe(instant.slice(0, 10));
    }
  });

  it('accepts the +00:00 form Supabase returns', () => {
    expect(localDateOf('2026-08-24T22:30:00+00:00', 'Europe/Paris')).toBe('2026-08-25');
  });
});
