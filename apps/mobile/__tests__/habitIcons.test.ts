import {
  DEFAULT_HABIT_ICON,
  getHabitIconLabel,
  getSuggestedHabitIcon,
  resolveHabitIcon,
} from '../utils/habitIcons';

describe('habitIcons', () => {
  it('suggests a hydration icon for water habits', () => {
    expect(getSuggestedHabitIcon('Drink water after lunch')).toBe('water');
  });

  it('suggests a reading icon for reading habits', () => {
    expect(getSuggestedHabitIcon('Read 10 pages')).toBe('book');
  });

  it('falls back to the default icon when no keyword matches', () => {
    expect(getSuggestedHabitIcon('Call grandma')).toBe(DEFAULT_HABIT_ICON);
  });

  it('prefers a saved icon over the inferred suggestion', () => {
    expect(resolveHabitIcon('Drink water', 'heart')).toBe('heart');
  });

  it('returns a friendly label for known icons', () => {
    expect(getHabitIconLabel('sparkles')).toBe('Self-care');
  });
});
