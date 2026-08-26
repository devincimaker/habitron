import { composeRatingsMessage, ratingWord } from '../utils/dayRatings';

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
