import type { JournalEntry } from '@habits-coach/shared';
import { readComposeIntent, useJournalComposer } from '../hooks/useJournalComposer';
import { renderHook } from './helpers/renderHook';

const replace = jest.fn();
let params: Record<string, string | string[] | undefined> = {};

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace }),
  useLocalSearchParams: () => params,
}));

describe('readComposeIntent', () => {
  it('is null when the link is not asking to compose', () => {
    expect(readComposeIntent({})).toBeNull();
    expect(readComposeIntent({ prompt: 'What shifted today?' })).toBeNull();
  });

  it('carries the prompt through', () => {
    expect(readComposeIntent({ compose: '1', prompt: 'What shifted today?' })).toEqual({
      prompt: 'What shifted today?',
      autoStartVoice: false,
    });
  });

  it('starts voice on 1 or true, and only those', () => {
    expect(readComposeIntent({ compose: '1', voice: '1' })?.autoStartVoice).toBe(true);
    expect(readComposeIntent({ compose: '1', voice: 'true' })?.autoStartVoice).toBe(true);
    expect(readComposeIntent({ compose: '1', voice: '0' })?.autoStartVoice).toBe(false);
  });

  // expo-router hands a repeated param over as an array; the first one wins.
  it('reads the first value when a param arrives repeated', () => {
    expect(readComposeIntent({ compose: ['1', '1'], voice: ['1'], prompt: ['a', 'b'] })).toEqual({
      prompt: 'a',
      autoStartVoice: true,
    });
  });
});

describe('useJournalComposer', () => {
  beforeEach(() => {
    replace.mockClear();
    params = {};
  });

  it('stays closed without a compose param', () => {
    const hook = renderHook(() => useJournalComposer());
    expect(hook.current().isOpen).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('opens once from the deep link, and consumes it by replacing the route', () => {
    params = { compose: '1', voice: '1', prompt: 'What shifted today?' };
    const hook = renderHook(() => useJournalComposer());

    expect(hook.current().isOpen).toBe(true);
    expect(hook.current().prompt).toBe('What shifted today?');
    expect(hook.current().autoStartVoice).toBe(true);
    expect(replace).toHaveBeenCalledWith('/journal');

    // A re-render with the param still in place must not reopen it.
    replace.mockClear();
    hook.act(() => hook.current().close());
    expect(hook.current().isOpen).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  // A link that landed while the user was mid-draft would swap the entry out
  // from under the sheet and take everything typed with it.
  it('does not open over a composer that is already open', () => {
    const hook = renderHook(() => useJournalComposer());
    hook.act(() => hook.current().open({ prompt: 'Mine' }));

    params = { compose: '1', prompt: 'The link' };
    hook.act(() => hook.current().open({ prompt: 'Mine' }));

    expect(hook.current().prompt).toBe('Mine');
    expect(replace).not.toHaveBeenCalled();
  });

  it('opens on an entry, and close clears the entry, the prompt and the voice flag', () => {
    const hook = renderHook(() => useJournalComposer());
    const entry: JournalEntry = {
      id: 'e1',
      entryDate: '2026-08-25',
      content: 'Something happened',
      source: 'manual',
      createdAt: 0,
      updatedAt: 0,
    };

    hook.act(() => hook.current().open({ entry, prompt: 'Again?', autoStartVoice: true }));
    expect(hook.current().isOpen).toBe(true);
    expect(hook.current().entry).toBe(entry);

    hook.act(() => hook.current().close());
    expect(hook.current()).toMatchObject({
      isOpen: false,
      entry: null,
      prompt: null,
      autoStartVoice: false,
    });
  });
});
