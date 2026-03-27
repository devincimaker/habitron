import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { AVATAR_SIZES } from '../../constants/theme';
import { useColors } from '../../hooks/useColors';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  text: string;
  size?: AvatarSize;
  backgroundColor?: string;
  textColor?: string;
  style?: ViewStyle;
}

export function Avatar({
  text,
  size = 'md',
  backgroundColor,
  textColor,
  style,
}: AvatarProps) {
  const colors = useColors();
  const sizeConfig = AVATAR_SIZES[size];

  return (
    <View
      style={[
        styles.base,
        {
          width: sizeConfig.size,
          height: sizeConfig.size,
          borderRadius: sizeConfig.borderRadius,
          backgroundColor: backgroundColor ?? colors.primary,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: sizeConfig.fontSize,
            color: textColor ?? colors.white,
          },
        ]}
      >
        {text.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: 'bold',
  },
});
