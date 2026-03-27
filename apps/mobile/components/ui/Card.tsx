import { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SPACING, BORDER_RADIUS, SHADOWS, CARD, type Colors } from '../../constants/theme';
import { useColors } from '../../hooks/useColors';

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
  const colors = useColors();
  const variantStyle = useMemo(() => getVariantStyle(colors, variant), [colors, variant]);

  return (
    <View
      style={[
        styles.base,
        !noPadding && styles.padding,
        !noMargin && styles.margin,
        variantStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function getVariantStyle(colors: Colors, variant: CardVariant): ViewStyle {
  switch (variant) {
    case 'surface':
      return { backgroundColor: colors.surface, ...SHADOWS.small };
    case 'outlined':
      return { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border };
    default:
      return { backgroundColor: colors.background, ...SHADOWS.small };
  }
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
