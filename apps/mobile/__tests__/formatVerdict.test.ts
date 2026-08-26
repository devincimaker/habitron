import { formatVerdict } from '../utils/coachSessions';

describe('formatVerdict', () => {
  it('names each rating', () => {
    expect([1, 2, 3, 4, 5].map((n) => formatVerdict(n))).toEqual([
      'Bad day',
      'Rough day',
      'OK day',
      'Good day',
      'Great day',
    ]);
  });

  it('is null when the day was reviewed without an overall', () => {
    expect(formatVerdict(undefined)).toBeNull();
  });
});
