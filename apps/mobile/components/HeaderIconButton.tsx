import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  HEADER,
  HEADER_CONTROL_HIT_SLOP,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface HeaderIconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
}

export function HeaderIconButton({
  name,
  accessibilityLabel,
  onPress,
}: HeaderIconButtonProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      hitSlop={HEADER_CONTROL_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons
        name={name}
        size={HEADER.controlIconSize}
        color={colors.controlIcon}
      />
    </Pressable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  button: {
    width: HEADER.controlSize,
    height: HEADER.controlSize,
    borderRadius: HEADER.controlRadius,
    backgroundColor: colors.controlFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
