import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from './useKeyboardHeight';

/**
 * What a page-sheet composer needs to keep one bar riding the keyboard: pad the
 * container by `keyboardHeight`, and give the bar `bottomInset` — the home
 * inset when the keyboard is down, 0 once the keyboard covers that inset.
 */
export function useSheetKeyboard(): { keyboardHeight: number; bottomInset: number } {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  return {
    keyboardHeight,
    bottomInset: keyboardHeight > 0 ? 0 : insets.bottom,
  };
}
