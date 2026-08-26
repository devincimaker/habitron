import {
  composeRatingsMessage,
  parseCoachRatings,
  ratingWord,
} from '../utils/dayRatings';

describe('ratingWord', () => {
  it('names each value on the shared ramp', () => {
    expect([1, 2, 3, 4, 5].map((v) => ratingWord('energy', v))).toEqual([
      'bad',
      'low',
      'ok',
      'good',
      'great',
    ]);
  });

  it('gives overall the verdict wording instead', () => {
    expect(ratingWord('overall', 4)).toBe('Good day');
  });

  it('is null while the axis is unrated', () => {
    expect(ratingWord('happy', undefined)).toBeNull();
  });
});

describe('composeRatingsMessage', () => {
  it('writes every axis in card order', () => {
    expect(
      composeRatingsMessage({ happy: 3, energy: 2, momentum: 4, calm: 3, overall: 4 })
    ).toBe('happy 3, energy 2, momentum 4, calm 3, overall 4');
  });

  // An unanswered axis must stay unanswered — never sent as a middling 3.
  it('leaves out the axes that were not rated', () => {
    expect(composeRatingsMessage({ energy: 2, overall: 4 })).toBe('energy 2, overall 4');
  });

  it('is empty when nothing is rated', () => {
    expect(composeRatingsMessage({})).toBe('');
  });
});

describe('parseCoachRatings', () => {
  const block = [
    'Plan 4/6 · Habits 2/3 · 5h20 logged',
    '',
    '  Happy      ○ ○ ● ○ ○   ok',
    '  Energy     ○ ● ○ ○ ○   low',
    '  Momentum   ○ ○ ○ ● ○   good',
    '  Calm       ○ ○ ● ○ ○   ok',
    '  Overall    ○ ○ ○ ● ○   good day',
    '',
    'Anything you want to change?',
  ].join('\n');

  it('reads the scale the coach printed', () => {
    expect(parseCoachRatings(block)).toEqual({
      happy: 3,
      energy: 2,
      momentum: 4,
      calm: 3,
      overall: 4,
    });
  });

  // The card pre-fills from what the coach heard, so a partial reading has to
  // stay partial: the axes it did not mention keep their hollow dots.
  it('leaves an all-hollow row unrated', () => {
    const partial = ['  Happy      ○ ○ ○ ○ ●   great', '  Calm       ○ ○ ○ ○ ○'].join('\n');
    expect(parseCoachRatings(partial)).toEqual({ happy: 5 });
  });

  it('reads a filled bar as its length', () => {
    expect(parseCoachRatings('  Energy     ● ● ● ○ ○   ok')).toEqual({ energy: 3 });
  });

  it('ignores rows that are not axes', () => {
    expect(parseCoachRatings('  Sleep      ○ ○ ● ○ ○   ok')).toBeNull();
  });

  it('is null when the message carries no scale', () => {
    expect(parseCoachRatings('How did today go?')).toBeNull();
  });
});
