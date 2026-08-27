import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const ROW_WIDTHS = ['100%', '92%', '60%'] as const;

/** Three pulsing rows under the text: where the transcribed paragraph lands. */
export function TranscriptionSkeleton() {
  const [styles] = useThemedStyles(createStyles);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={[styles.rows, pulseStyle]} accessibilityLabel="Transcribing">
      {ROW_WIDTHS.map((width) => (
        <Animated.View key={width} style={[styles.row, { width }]} />
      ))}
    </Animated.View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  rows: {
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  row: {
    height: 12,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: colors.border,
  },
});
