import { keyboardHeightFromFrame } from '../utils/keyboardHeight';

const SCREEN_HEIGHT = 844;

describe('keyboardHeightFromFrame', () => {
  it('reports the covered height when the keyboard is up', () => {
    // iPhone 16e, English keyboard with the predictive bar: top edge at 508.
    expect(
      keyboardHeightFromFrame({ screenY: 508 }, SCREEN_HEIGHT)
    ).toBe(336);
  });

  it('grows when the frame does', () => {
    expect(keyboardHeightFromFrame({ screenY: 552 }, SCREEN_HEIGHT)).toBe(292);
    expect(keyboardHeightFromFrame({ screenY: 508 }, SCREEN_HEIGHT)).toBe(336);
  });

  it('is 0 when the frame sits on the bottom edge, which is a dismissal', () => {
    expect(keyboardHeightFromFrame({ screenY: SCREEN_HEIGHT }, SCREEN_HEIGHT)).toBe(0);
  });

  it('is 0, never negative, for a frame parked off the bottom', () => {
    expect(keyboardHeightFromFrame({ screenY: 1180 }, SCREEN_HEIGHT)).toBe(0);
  });
});
