jest.mock('@habits-coach/shared', () => ({
  getTodayDate: () => '2026-04-16',
}));

import {
  compareTodoScheduledTimes,
  formatTodoScheduledTime,
  normalizeTodoScheduledTimeInput,
  resolveNewTodoSchedule,
} from '../utils/todoTime';

describe('todoTime utils', () => {
  it('normalizes compact time inputs into HH:MM', () => {
    expect(normalizeTodoScheduledTimeInput('9')).toBe('09:00');
    expect(normalizeTodoScheduledTimeInput('930')).toBe('09:30');
    expect(normalizeTodoScheduledTimeInput('1230')).toBe('12:30');
    expect(normalizeTodoScheduledTimeInput('9:05')).toBe('09:05');
  });

  it('rejects invalid time strings', () => {
    expect(normalizeTodoScheduledTimeInput('')).toBeUndefined();
    expect(normalizeTodoScheduledTimeInput('24:00')).toBeNull();
    expect(normalizeTodoScheduledTimeInput('9:7')).toBeNull();
    expect(normalizeTodoScheduledTimeInput('abcd')).toBeNull();
  });

  it('formats stored times for display', () => {
    expect(formatTodoScheduledTime('09:30')).toBe('09:30');
    expect(formatTodoScheduledTime('13:05')).toBe('13:05');
  });

  it('defaults new scheduled times onto today when no date is provided', () => {
    expect(resolveNewTodoSchedule(undefined, '20:00')).toEqual({
      scheduledDate: '2026-04-16',
      scheduledTime: '20:00',
    });
    expect(resolveNewTodoSchedule('2026-04-20', '20:00')).toEqual({
      scheduledDate: '2026-04-20',
      scheduledTime: '20:00',
    });
  });

  it('sorts actual times before untimed tasks', () => {
    expect(compareTodoScheduledTimes('09:00', '13:00')).toBeLessThan(0);
    expect(compareTodoScheduledTimes('13:00', undefined)).toBeLessThan(0);
    expect(compareTodoScheduledTimes(undefined, '13:00')).toBeGreaterThan(0);
  });
});
