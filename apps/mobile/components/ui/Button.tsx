import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, type Colors } from '../../constants/theme';
import { useColors } from '../../hooks/useColors';

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
  const colors = useColors();
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
          colors={isDisabled ? [colors.border, colors.border] : [colors.primary, colors.primaryDark]}
          style={[styles.base, sizeStyle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={[styles.text, { color: colors.white }]}>{title}</Text>
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
          colors={isDisabled ? [colors.border, colors.border] : [colors.error, '#D32F2F']}
          style={[styles.base, sizeStyle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={[styles.text, { color: colors.white }]}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Other variants
  const variantStyles = getVariantStyles(colors, variant, isDisabled);

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
  colors: Colors,
  variant: ButtonVariant,
  disabled: boolean
): { container: ViewStyle; textColor: string } {
  if (disabled) {
    return {
      container: { backgroundColor: colors.surface },
      textColor: colors.textLight,
    };
  }

  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: colors.surface },
        textColor: colors.text,
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        },
        textColor: colors.text,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        textColor: colors.textSecondary,
      };
    default:
      return {
        container: { backgroundColor: colors.primary },
        textColor: colors.white,
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
});
