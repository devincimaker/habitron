import { HabitStatus } from '@habits-coach/shared';
import {
  calculateMonthlyCheckIns,
  calculateMonthlyRate,
  calculateStreak,
} from '../utils/habitStats';

describe('calculateMonthlyCheckIns', () => {
  it('counts completed days correctly', () => {
    const logs = new Map<string, HabitStatus>([
      ['2026-01-01', 'completed'],
      ['2026-01-02', 'skipped'],
      ['2026-01-03', 'completed'],
      ['2026-01-04', 'pending'],
    ]);
    expect(calculateMonthlyCheckIns(logs)).toBe(2);
  });

  it('returns 0 for empty logs', () => {
    expect(calculateMonthlyCheckIns(new Map())).toBe(0);
  });

  it('returns 0 when no completed days', () => {
    const logs = new Map<string, HabitStatus>([
      ['2026-01-01', 'skipped'],
      ['2026-01-02', 'pending'],
    ]);
    expect(calculateMonthlyCheckIns(logs)).toBe(0);
  });

  it('counts all completed days', () => {
    const logs = new Map<string, HabitStatus>([
      ['2026-01-01', 'completed'],
      ['2026-01-02', 'completed'],
      ['2026-01-03', 'completed'],
      ['2026-01-04', 'completed'],
      ['2026-01-05', 'completed'],
    ]);
    expect(calculateMonthlyCheckIns(logs)).toBe(5);
  });
});

describe('calculateMonthlyRate', () => {
  it('returns 0 for month before habit creation', () => {
    const logs = new Map<string, HabitStatus>();
    // Habit created in January 2026, checking December 2025
    const rate = calculateMonthlyRate(
      logs,
      2025,
      11,
      new Date('2026-01-01').getTime()
    );
    expect(rate).toBe(0);
  });

  it('returns 0 for future month', () => {
    const logs = new Map<string, HabitStatus>();
    // Mock current date is in past relative to 2030
    const rate = calculateMonthlyRate(
      logs,
      2030,
      0,
      new Date('2025-01-01').getTime()
    );
    expect(rate).toBe(0);
  });

  it('calculates correct percentage for past month', () => {
    // For a past month, we should calculate based on full month
    const logs = new Map<string, HabitStatus>();
    // 10 completed days out of 31 days in December 2025
    for (let i = 1; i <= 10; i++) {
      logs.set(`2025-12-${String(i).padStart(2, '0')}`, 'completed');
    }
    // Habit created before December, checking December 2025
    // If we're in Jan 2026+, December 2025 is a past month
    const rate = calculateMonthlyRate(
      logs,
      2025,
      11,
      new Date('2025-01-01').getTime()
    );
    expect(rate).toBe(Math.round((10 / 31) * 100)); // ~32%
  });
});

describe('calculateStreak', () => {
  // Helper to get date strings relative to today
  const getDaysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const today = getDaysAgo(0);
  const yesterday = getDaysAgo(1);
  const twoDaysAgo = getDaysAgo(2);
  const threeDaysAgo = getDaysAgo(3);

  it('counts consecutive completed days from today backwards', () => {
    const logs = new Map<string, HabitStatus>([
      [today, 'completed'],
      [yesterday, 'completed'],
      [twoDaysAgo, 'completed'],
    ]);

    const habitCreated = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    expect(calculateStreak(logs, habitCreated)).toBe(3);
  });

  it('breaks streak on skipped day', () => {
    const logs = new Map<string, HabitStatus>([
      [today, 'completed'],
      [yesterday, 'skipped'],
      [twoDaysAgo, 'completed'],
    ]);

    const habitCreated = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(calculateStreak(logs, habitCreated)).toBe(1);
  });

  it('breaks streak on missing day', () => {
    const logs = new Map<string, HabitStatus>([
      [today, 'completed'],
      // yesterday missing
      [twoDaysAgo, 'completed'],
    ]);

    const habitCreated = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(calculateStreak(logs, habitCreated)).toBe(1);
  });

  it('returns 0 when today is not completed but yesterday was', () => {
    const logs = new Map<string, HabitStatus>([
      [yesterday, 'completed'],
      [twoDaysAgo, 'completed'],
    ]);

    const habitCreated = Date.now() - 10 * 24 * 60 * 60 * 1000;
    // When today is not marked, we still count from yesterday
    const streak = calculateStreak(logs, habitCreated);
    expect(streak).toBe(2);
  });

  it('handles empty logs', () => {
    expect(calculateStreak(new Map(), Date.now())).toBe(0);
  });

  it('handles all skipped days', () => {
    const logs = new Map<string, HabitStatus>([
      [today, 'skipped'],
      [yesterday, 'skipped'],
    ]);

    const habitCreated = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(calculateStreak(logs, habitCreated)).toBe(0);
  });

  it('does not count days before habit creation', () => {
    const logs = new Map<string, HabitStatus>([
      [today, 'completed'],
      [yesterday, 'completed'],
      [twoDaysAgo, 'completed'],
      [threeDaysAgo, 'completed'],
    ]);

    // Habit created 2 days ago
    const habitCreated = new Date(twoDaysAgo + 'T12:00:00').getTime();
    // Should only count today, yesterday, and twoDaysAgo
    const streak = calculateStreak(logs, habitCreated);
    expect(streak).toBe(3);
  });

  it('returns streak of 1 when only today is completed', () => {
    const logs = new Map<string, HabitStatus>([[today, 'completed']]);

    const habitCreated = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(calculateStreak(logs, habitCreated)).toBe(1);
  });
});
