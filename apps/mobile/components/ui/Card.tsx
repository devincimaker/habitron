import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, CARD } from '../../constants/theme';

type CardVariant = 'default' | 'surface' | 'outlined';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  noPadding?: boolean;
  noMargin?: boolean;
}

export function Card({
  children,
  variant = 'default',
  style,
  noPadding = false,
  noMargin = false,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        !noPadding && styles.padding,
        !noMargin && styles.margin,
        variantStyles[variant],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: CARD.borderRadius,
  },
  padding: {
    padding: CARD.padding,
  },
  margin: {
    marginBottom: CARD.marginBottom,
  },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: COLORS.background,
    ...SHADOWS.small,
  },
  surface: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.small,
  },
  outlined: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
