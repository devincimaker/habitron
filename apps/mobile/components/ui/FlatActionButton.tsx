import { Pressable, StyleSheet, Text } from 'react-native';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

interface FlatActionButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  height: number;
  accessibilityLabel?: string;
}

/**
 * The flat primary action a composer bar carries: `primaryDark` fill, radius 8,
 * white 16/600; disabled is `surface` with a `border` stroke and a `textLight`
 * label. Not `Button`, whose primary variant draws a gradient.
 */
export function FlatActionButton({
  title,
  onPress,
  disabled = false,
  height,
  accessibilityLabel,
}: FlatActionButtonProps) {
  const [styles] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={[styles.action, { height }, disabled && styles.actionDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: colors.primaryDark,
    },
    actionDisabled: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    label: {
      ...TYPOGRAPHY.headingMedium,
      color: colors.white,
    },
    labelDisabled: {
      color: colors.textLight,
    },
  });
