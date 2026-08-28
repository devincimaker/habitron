import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BodyMedium } from './ui';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface UndoBannerProps {
  label: string;
  bottom: number;
  onUndo: () => void;
}

/** What a delete leaves behind for as long as it can still be taken back. */
export function UndoBanner({ label, bottom, onUndo }: UndoBannerProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      style={[styles.banner, { bottom }]}
      accessibilityRole="alert"
    >
      <BodyMedium color={colors.white}>{label}</BodyMedium>
      <Pressable onPress={onUndo} accessibilityLabel="Undo delete" accessibilityRole="button">
        <BodyMedium color={colors.primaryDark} style={styles.action}>
          Undo
        </BodyMedium>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    banner: {
      position: 'absolute',
      left: SPACING.md,
      right: SPACING.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.xl,
      backgroundColor: colors.text,
    },
    action: {
      fontWeight: '600',
    },
  });
