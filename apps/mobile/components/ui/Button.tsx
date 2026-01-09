import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const SIZE_STYLES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number }> = {
  sm: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  md: { paddingVertical: 12, paddingHorizontal: SPACING.lg },
  lg: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  // Primary variant uses gradient
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={isDisabled ? [COLORS.border, COLORS.border] : [COLORS.primary, COLORS.primaryDark]}
          style={[styles.base, sizeStyle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={[styles.text, styles.primaryText]}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Destructive variant uses red gradient
  if (variant === 'destructive') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={isDisabled ? [COLORS.border, COLORS.border] : [COLORS.error, '#D32F2F']}
          style={[styles.base, sizeStyle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={[styles.text, styles.primaryText]}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Other variants
  const variantStyles = getVariantStyles(variant, isDisabled);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        sizeStyle,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: variantStyles.textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function getVariantStyles(
  variant: ButtonVariant,
  disabled: boolean
): { container: ViewStyle; textColor: string } {
  if (disabled) {
    return {
      container: { backgroundColor: COLORS.surface },
      textColor: COLORS.textLight,
    };
  }

  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: COLORS.surface },
        textColor: COLORS.text,
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: COLORS.border,
        },
        textColor: COLORS.text,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        textColor: COLORS.textSecondary,
      };
    default:
      return {
        container: { backgroundColor: COLORS.primary },
        textColor: COLORS.white,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...TYPOGRAPHY.headingMedium,
  },
  primaryText: {
    color: COLORS.white,
  },
});
