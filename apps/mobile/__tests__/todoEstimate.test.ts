import {
  decrementDuration,
  formatDurationMinutes,
  getEstimateDelta,
  getInlineEstimateContext,
  incrementDuration,
  parseDurationMinutes,
  stripInlineEstimateToken,
} from '../utils/todoEstimate';

describe('todoEstimate', () => {
  it.each([
    ['15m', 15],
    ['1h 50m', 110],
    ['1h50m', 110],
    ['2h', 120],
    ['90 min', 90],
    ['1.5h', 90],
    ['45 minutes', 45],
  ])('parses "%s" as %i minutes', (input, expected) => {
    expect(parseDurationMinutes(input)).toBe(expected);
  });

  it.each(['', 'call mum', '0m', 'h', '10', '1h 2h'])('rejects "%s"', (input) => {
    expect(parseDurationMinutes(input)).toBeNull();
  });

  it('finds the first parenthesised duration in the composer text', () => {
    expect(getInlineEstimateContext('Renew car insurance (1h 50m) #admin')).toEqual({
      start: 20,
      end: 28,
      raw: '(1h 50m)',
      minutes: 110,
    });
  });

  it('skips parentheses that are not durations', () => {
    expect(getInlineEstimateContext('Call mum (she asked) (15m)')).toEqual(
      expect.objectContaining({ raw: '(15m)', minutes: 15 })
    );
    expect(getInlineEstimateContext('Call mum (she asked)')).toBeNull();
  });

  it('strips the estimate token but leaves other parentheses alone', () => {
    expect(stripInlineEstimateToken('Call mum (she asked) (15m) today')).toBe(
      'Call mum (she asked)   today'
    );
  });

  it('formats minutes as hours and minutes', () => {
    expect(formatDurationMinutes(5)).toBe('5m');
    expect(formatDurationMinutes(60)).toBe('1h');
    expect(formatDurationMinutes(110)).toBe('1h 50m');
  });

  it('steps by 5m under an hour, 15m under four hours, 30m beyond', () => {
    expect(incrementDuration(30)).toBe(35);
    expect(incrementDuration(60)).toBe(75);
    expect(incrementDuration(240)).toBe(270);
    expect(decrementDuration(60)).toBe(55);
    expect(decrementDuration(240)).toBe(225);
    expect(decrementDuration(5)).toBe(5);
  });

  it('describes the delta between estimate and actual', () => {
    expect(getEstimateDelta(30, 30)).toEqual({ minutes: 0, tone: 'exact', label: 'spot on' });
    expect(getEstimateDelta(30, 45)).toEqual({ minutes: 15, tone: 'over', label: '+15m over' });
    expect(getEstimateDelta(60, 45)).toEqual({ minutes: -15, tone: 'under', label: '15m under' });
  });
});
