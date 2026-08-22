import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { AVATAR_SIZES } from '../../constants/theme';
import { useColors } from '../../hooks/useColors';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  text?: string | null;
  size?: AvatarSize;
  backgroundColor?: string;
  textColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Avatar({
  text,
  size = 'md',
  backgroundColor,
  textColor,
  style,
  textStyle,
}: AvatarProps) {
  const colors = useColors();
  const sizeConfig = AVATAR_SIZES[size];
  const avatarText =
    typeof text === 'string' && text.trim().length > 0
      ? text.trim().charAt(0).toUpperCase()
      : '?';

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
          textStyle,
        ]}
      >
        {avatarText}
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
