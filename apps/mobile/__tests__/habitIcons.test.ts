import {
  DEFAULT_HABIT_ICON,
  getHabitIconAccentColor,
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

  it('prefers meditation matches over generic language keywords', () => {
    expect(getSuggestedHabitIcon('Practice meditating for 10 minutes')).toBe('leaf');
  });

  it('does not match partial words inside unrelated words', () => {
    expect(getSuggestedHabitIcon('Pride march downtown')).toBe(DEFAULT_HABIT_ICON);
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

  it('returns the configured accent color for an icon', () => {
    expect(getHabitIconAccentColor('water')).toBe('#78C9FF');
  });
});
