import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { renderHook } from './helpers/renderHook';

interface Entry {
  id: string;
}

const entry: Entry = { id: 'entry-1' };

describe('useUndoableDelete', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('hides the item at once and commits it when the window closes', () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useUndoableDelete<Entry>(commit));

    hook.act(() => hook.current().remove(entry));
    expect(hook.current().pending).toBe(entry);
    expect(commit).not.toHaveBeenCalled();

    hook.act(() => jest.advanceTimersByTime(5000));
    expect(hook.current().pending).toBeNull();
    expect(commit).toHaveBeenCalledWith(entry);
  });

  it('restores the item and never commits when undone in time', () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useUndoableDelete<Entry>(commit));

    hook.act(() => hook.current().remove(entry));
    hook.act(() => jest.advanceTimersByTime(4000));
    hook.act(() => hook.current().undo());

    expect(hook.current().pending).toBeNull();
    hook.act(() => jest.advanceTimersByTime(5000));
    expect(commit).not.toHaveBeenCalled();
  });

  // Leaving the screen cancels the commit — the same promise the banner makes,
  // and the behaviour the journal screen had before the hook existed.
  it('drops the pending commit on unmount', () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useUndoableDelete<Entry>(commit));

    hook.act(() => hook.current().remove(entry));
    hook.unmount();
    jest.advanceTimersByTime(5000);

    expect(commit).not.toHaveBeenCalled();
  });

  it('replaces a pending delete rather than losing its timer', () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const second: Entry = { id: 'entry-2' };
    const hook = renderHook(() => useUndoableDelete<Entry>(commit));

    hook.act(() => hook.current().remove(entry));
    hook.act(() => jest.advanceTimersByTime(3000));
    hook.act(() => hook.current().remove(second));
    hook.act(() => jest.advanceTimersByTime(5000));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(second);
  });
});
