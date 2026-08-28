import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';

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
 * commit runs when the undo window closes, so the list never waits on the
 * network to look right; leaving the screen before the timer fires cancels the
 * commit, which is the same promise the banner makes.
 */
export function useUndoableDelete<T>(commit: (item: T) => Promise<void>): UndoableDelete<T> {
  const [pending, setPending] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const run = useCallback(
    async (item: T) => {
      try {
        await commit(item);
      } catch (error) {
        console.warn('Failed to delete:', error);
        Sentry.captureException(error, { tags: { feature: 'undoable-delete' } });
      } finally {
        // Only after the commit has landed: the list is the source of truth
        // again from here, and clearing sooner shows the row for as long as the
        // network takes.
        setPending((current) => (current === item ? null : current));
      }
    },
    [commit]
  );

  const remove = useCallback(
    (item: T) => {
      // A second delete inside the window commits the first rather than
      // cancelling it — only `undo` takes a delete back.
      const previous = pending;
      clear();
      if (previous !== null && previous !== item) void run(previous);

      setPending(item);
      timer.current = setTimeout(() => {
        timer.current = null;
        void run(item);
      }, UNDO_MS);
    },
    [clear, pending, run]
  );

  const undo = useCallback(() => {
    clear();
    setPending(null);
  }, [clear]);

  return { pending, remove, undo };
}
