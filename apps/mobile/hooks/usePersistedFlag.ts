import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A boolean the app remembers between launches — a preference, not a per-visit
 * gesture.
 *
 * `isReady` is false until storage has answered, so a screen can hold off
 * drawing the thing that would otherwise flip under the user a frame later.
 */
export function usePersistedFlag(
  key: string,
  initial = false
): { value: boolean; isReady: boolean; toggle: () => void } {
  const [value, setValue] = useState(initial);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((stored) => {
        if (!active) return;
        if (stored !== null) setValue(stored === '1');
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);

  // Written here rather than inside the state updater, which React may run more
  // than once — and only on a real change, so mounting writes nothing back.
  const toggle = useCallback(() => {
    const next = !value;
    setValue(next);
    void AsyncStorage.setItem(key, next ? '1' : '0').catch(() => {});
  }, [key, value]);

  return { value, isReady, toggle };
}
