import { createSentenceChunker, toSpokenText } from '../utils/speechChunker';

describe('toSpokenText', () => {
  it('drops markdown marks and keeps the words', () => {
    expect(toSpokenText('## Today\n\n- **Gym** at 7\n- Call _Sam_\n\nUse `list_tasks`.')).toBe(
      'Today\n\nGym at 7\nCall Sam\n\nUse list_tasks.'
    );
  });

  it('leaves numbered lists as sentences', () => {
    expect(toSpokenText('1. Breathe\n2) Stretch')).toBe('Breathe\nStretch');
  });
});

describe('createSentenceChunker', () => {
  it('speaks the first sentence the moment it is complete, whatever arrives after', () => {
    const chunker = createSentenceChunker();

    expect(chunker.push('Nice work')).toEqual([]);
    expect(chunker.push(' today. How did')).toEqual(['Nice work today.']);
    expect(chunker.push(' the sit go?')).toEqual([]);
    expect(chunker.flush()).toBe('How did the sit go?');
  });

  it('merges short later sentences so one word is never its own request', () => {
    const chunker = createSentenceChunker({ minChars: 30 });

    chunker.push('First one here. ');
    expect(chunker.push('Okay. Sure. That works for me and then some. Next')).toEqual([
      'Okay. Sure. That works for me and then some.',
    ]);
    expect(chunker.flush()).toBe('Next');
  });

  it('treats a paragraph break as a boundary', () => {
    const chunker = createSentenceChunker();

    expect(chunker.push('Thursday is the real weight here\n\nShall we')).toEqual([
      'Thursday is the real weight here',
    ]);
  });

  it('does not split inside a time or a decimal', () => {
    const chunker = createSentenceChunker();

    expect(chunker.push('Gym at 9.30 then. ')).toEqual(['Gym at 9.30 then.']);
  });

  it('strips markdown from what it hands over and skips empty chunks', () => {
    const chunker = createSentenceChunker();

    expect(chunker.push('- **Gym**. ')).toEqual(['Gym.']);
    expect(chunker.flush()).toBeNull();
  });

  it('flushes nothing twice', () => {
    const chunker = createSentenceChunker();
    chunker.push('Hello');

    expect(chunker.flush()).toBe('Hello');
    expect(chunker.flush()).toBeNull();
  });
});
