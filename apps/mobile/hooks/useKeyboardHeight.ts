import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent } from 'react-native';
import { keyboardHeightFromFrame } from '../utils/keyboardHeight';

/**
 * How much of the screen the keyboard covers right now, 0 when it is down.
 *
 * `keyboardWillChangeFrame` fires before the animation for every frame change
 * — showing, hiding, and growing when the predictive bar appears — so padding
 * a layout by this value moves it with the keyboard rather than after it.
 * `KeyboardAvoidingView` cannot do that job inside a `pageSheet` modal: it
 * compares a sheet-relative frame against a window-relative keyboard origin
 * and lands short by the sheet's top inset.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const willChangeFrame = Keyboard.addListener(
      'keyboardWillChangeFrame',
      (event: KeyboardEvent) => {
        setHeight(
          keyboardHeightFromFrame(
            event.endCoordinates,
            Dimensions.get('screen').height
          )
        );
      }
    );
    const willHide = Keyboard.addListener('keyboardWillHide', () =>
      setHeight(0)
    );

    return () => {
      willChangeFrame.remove();
      willHide.remove();
    };
  }, []);

  return height;
}
