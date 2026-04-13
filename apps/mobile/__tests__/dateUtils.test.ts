import {
  getLast7Days,
  canGoToPreviousDay,
  canGoToNextDay,
  getPreviousDay,
  getNextDay,
  formatDateString,
  formatShortDate,
  getTaskDateBadge,
} from '../utils/dateUtils';
import { getTodayDate } from '@habits-coach/shared';

describe('dateUtils', () => {
  const today = getTodayDate();
  const yesterday = getPreviousDay(today);
  const sixDaysAgo = getPreviousDay(
    getPreviousDay(
      getPreviousDay(getPreviousDay(getPreviousDay(getPreviousDay(today))))
    )
  );
  const sevenDaysAgo = getPreviousDay(sixDaysAgo);

  describe('getLast7Days', () => {
    it('returns exactly 7 days', () => {
      const days = getLast7Days();
      expect(days).toHaveLength(7);
    });

    it('has today as the last (rightmost) day', () => {
      const days = getLast7Days();
      const lastDay = days[days.length - 1];
      expect(lastDay.isToday).toBe(true);
    });

    it('has only one day marked as today', () => {
      const days = getLast7Days();
      const todayCount = days.filter((d) => d.isToday).length;
      expect(todayCount).toBe(1);
    });

    it('returns days in chronological order (oldest first)', () => {
      const days = getLast7Days();
      for (let i = 1; i < days.length; i++) {
        expect(new Date(days[i].date).getTime()).toBeGreaterThan(
          new Date(days[i - 1].date).getTime()
        );
      }
    });

    it('returns valid weekday letters', () => {
      const validLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const days = getLast7Days();
      days.forEach((day) => {
        expect(validLetters).toContain(day.weekdayLetter);
      });
    });

    it('returns dates in YYYY-MM-DD format', () => {
      const days = getLast7Days();
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      days.forEach((day) => {
        expect(day.date).toMatch(dateRegex);
      });
    });
  });

  describe('canGoToPreviousDay', () => {
    it('returns true for today', () => {
      expect(canGoToPreviousDay(today)).toBe(true);
    });

    it('returns true for yesterday', () => {
      expect(canGoToPreviousDay(yesterday)).toBe(true);
    });

    it('returns false for 6 days ago (the boundary)', () => {
      expect(canGoToPreviousDay(sixDaysAgo)).toBe(false);
    });

    it('returns false for 7 days ago', () => {
      expect(canGoToPreviousDay(sevenDaysAgo)).toBe(false);
    });
  });

  describe('canGoToNextDay', () => {
    it('returns false for today', () => {
      expect(canGoToNextDay(today)).toBe(false);
    });

    it('returns true for yesterday', () => {
      expect(canGoToNextDay(yesterday)).toBe(true);
    });

    it('returns true for 6 days ago', () => {
      expect(canGoToNextDay(sixDaysAgo)).toBe(true);
    });
  });

  describe('getPreviousDay', () => {
    it('returns the day before the given date', () => {
      expect(getPreviousDay('2026-01-15')).toBe('2026-01-14');
    });

    it('handles month boundaries', () => {
      expect(getPreviousDay('2026-02-01')).toBe('2026-01-31');
    });

    it('handles year boundaries', () => {
      expect(getPreviousDay('2026-01-01')).toBe('2025-12-31');
    });
  });

  describe('getNextDay', () => {
    it('returns the day after the given date', () => {
      expect(getNextDay('2026-01-15')).toBe('2026-01-16');
    });

    it('handles month boundaries', () => {
      expect(getNextDay('2026-01-31')).toBe('2026-02-01');
    });

    it('handles year boundaries', () => {
      expect(getNextDay('2025-12-31')).toBe('2026-01-01');
    });
  });

  describe('formatDateString', () => {
    it('formats a date string for display', () => {
      const formatted = formatDateString('2026-01-11');
      // The exact format depends on locale, but it should include the day
      expect(formatted).toContain('11');
      expect(formatted).toContain('January');
    });
  });

  describe('getTaskDateBadge', () => {
    const tomorrow = getNextDay(today);

    it('returns an overdue badge for past dates', () => {
      expect(getTaskDateBadge(yesterday)).toEqual({
        label: formatShortDate(yesterday),
        tone: 'overdue',
      });
    });

    it('returns today for the current date', () => {
      expect(getTaskDateBadge(today)).toEqual({
        label: 'Today',
        tone: 'upcoming',
      });
    });

    it('returns tomorrow for the next date', () => {
      expect(getTaskDateBadge(tomorrow)).toEqual({
        label: 'Tomorrow',
        tone: 'upcoming',
      });
    });
  });
});
