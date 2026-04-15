import { normalizeHabitName } from '../utils/habitNames';

describe('normalizeHabitName', () => {
  it('capitalizes the first character of a lowercase habit name', () => {
    expect(normalizeHabitName('meditar')).toBe('Meditar');
  });

  it('trims leading and trailing whitespace before capitalizing', () => {
    expect(normalizeHabitName('  workout  ')).toBe('Workout');
  });

  it('leaves an already-capitalized habit name unchanged', () => {
    expect(normalizeHabitName('Adds')).toBe('Adds');
  });

  it('returns an empty string for blank values', () => {
    expect(normalizeHabitName('   ')).toBe('');
  });
});
