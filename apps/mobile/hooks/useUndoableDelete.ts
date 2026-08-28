import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the banner stands before the delete is real. */
const UNDO_MS = 5000;

export interface UndoableDelete<T> {
  /** Deleted on screen, not yet committed. Hide it from the list while it is set. */
  pending: T | null;
  /** Hides the item now and commits it when the window closes. */
  remove: (item: T) => void;
  /** Puts it back, if the window is still open. */
  undo: () => void;
}

/**
 * A delete the user can take back. The item disappears immediately and the
 * commit runs `delay` later, so the list never waits on the network to look
 * right; leaving the screen before the timer fires cancels the commit, which is
 * the same promise the banner makes.
 */
export function useUndoableDelete<T>(
  commit: (item: T) => Promise<void>,
  delay = UNDO_MS
): UndoableDelete<T> {
  const [pending, setPending] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const remove = useCallback(
    (item: T) => {
      clear();
      setPending(item);
      timer.current = setTimeout(() => {
        timer.current = null;
        setPending(null);
        void commit(item).catch((error) => console.warn('Failed to delete:', error));
      }, delay);
    },
    [clear, commit, delay]
  );

  const undo = useCallback(() => {
    clear();
    setPending(null);
  }, [clear]);

  return { pending, remove, undo };
}
