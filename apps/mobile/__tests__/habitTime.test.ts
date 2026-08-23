import {
  addMinutesToTime,
  formatReminderTime,
  getHourMinute,
  parseClockTime,
  toClockTimeString,
} from '../utils/habitTime';

describe('habitTime', () => {
  it('round-trips 24h strings through 12h picker parts', () => {
    expect(parseClockTime('15:00')).toEqual({ hour12: 3, minute: 0, period: 'PM' });
    expect(parseClockTime('00:30')).toEqual({ hour12: 12, minute: 30, period: 'AM' });
    expect(parseClockTime('12:05')).toEqual({ hour12: 12, minute: 5, period: 'PM' });

    expect(toClockTimeString({ hour12: 3, minute: 0, period: 'PM' })).toBe('15:00');
    expect(toClockTimeString({ hour12: 12, minute: 30, period: 'AM' })).toBe('00:30');
    expect(toClockTimeString({ hour12: 12, minute: 5, period: 'PM' })).toBe('12:05');
  });

  it('formats reminder times for display', () => {
    expect(formatReminderTime('15:00')).toBe('3:00 PM');
    expect(formatReminderTime('09:05')).toBe('9:05 AM');
  });

  it('splits hour and minute', () => {
    expect(getHourMinute('07:45')).toEqual({ hour: 7, minute: 45 });
  });

  it('adds minutes and wraps past midnight', () => {
    expect(addMinutesToTime('23:45', 30)).toBe('00:15');
    expect(addMinutesToTime('09:00', 90)).toBe('10:30');
  });
});
