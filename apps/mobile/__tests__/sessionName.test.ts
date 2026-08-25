import { deriveSessionName } from '../utils/sessionName';

describe('deriveSessionName', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(deriveSessionName('')).toBeNull();
    expect(deriveSessionName('   \n\t ')).toBeNull();
  });

  it('collapses whitespace and trims short messages', () => {
    expect(deriveSessionName('  Help me\n\nplan   my week  ')).toBe('Help me plan my week');
  });

  it('keeps a message at exactly the limit intact', () => {
    const text = 'a'.repeat(48);
    expect(deriveSessionName(text)).toBe(text);
  });

  it('truncates on a word boundary and appends an ellipsis', () => {
    const name = deriveSessionName(
      'I want to build a morning routine that actually sticks this time around'
    );
    expect(name).toBe('I want to build a morning routine that actually…');
    expect(name!.length).toBeLessThanOrEqual(49);
  });

  it('drops trailing punctuation left at the cut', () => {
    expect(
      deriveSessionName('Okay so, here is the thing about my habits, they never, ever last')
    ).toBe('Okay so, here is the thing about my habits…');
  });

  it('cuts mid-word when the message has no usable space', () => {
    const name = deriveSessionName('x'.repeat(80));
    expect(name).toBe(`${'x'.repeat(48)}…`);
  });
});
