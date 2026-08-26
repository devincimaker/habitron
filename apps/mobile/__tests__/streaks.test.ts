import { dateStreak } from '../utils/streaks';

describe('dateStreak', () => {
  it('is zero when nothing has been recorded', () => {
    expect(dateStreak([], '2026-08-26')).toEqual({ current: 0, longest: 0 });
  });

  it('counts the run ending today', () => {
    const dates = ['2026-08-24', '2026-08-25', '2026-08-26'];
    expect(dateStreak(dates, '2026-08-26')).toEqual({ current: 3, longest: 3 });
  });

  // The grace rule: the day is not over, so a missing today is not a break.
  it('keeps the streak alive when today is still missing', () => {
    const dates = ['2026-08-24', '2026-08-25'];
    expect(dateStreak(dates, '2026-08-26')).toEqual({ current: 2, longest: 2 });
  });

  it('resets when yesterday was missed', () => {
    const dates = ['2026-08-22', '2026-08-23', '2026-08-24'];
    expect(dateStreak(dates, '2026-08-26')).toEqual({ current: 0, longest: 3 });
  });

  it('remembers the longest run after a reset', () => {
    const dates = [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-25',
      '2026-08-26',
    ];
    expect(dateStreak(dates, '2026-08-26')).toEqual({ current: 2, longest: 4 });
  });

  // A ritual can be recorded for an earlier date, so the input arrives
  // unsorted and can repeat; backfilling the gap rejoins the two runs.
  it('sorts and dedupes, so a backfilled date closes the gap', () => {
    const dates = ['2026-08-26', '2026-08-24', '2026-08-26', '2026-08-25'];
    expect(dateStreak(dates, '2026-08-26')).toEqual({ current: 3, longest: 3 });
  });

  it('crosses a month boundary', () => {
    const dates = ['2026-07-31', '2026-08-01'];
    expect(dateStreak(dates, '2026-08-01')).toEqual({ current: 2, longest: 2 });
  });
});
