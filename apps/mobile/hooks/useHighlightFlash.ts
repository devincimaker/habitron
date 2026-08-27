import { useCallback } from 'react';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from './useColors';

const FLASH_MS = 1500;
/** 0.3 over `primaryLight`; every theme value is 6-digit hex, so one byte. */
const PEAK_ALPHA = '4D';

/**
 * The amber "something just landed here" flash: `flash()` paints the peak and
 * fades back to `background` over 1.5 s. Spread `style` on an Animated.View.
 */
export function useHighlightFlash() {
  const colors = useColors();
  const progress = useSharedValue(0);

  const flash = useCallback(() => {
    progress.value = 1;
    progress.value = withTiming(0, { duration: FLASH_MS });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.background, `${colors.primaryLight}${PEAK_ALPHA}`]
    ),
  }));

  return { flash, style };
}
