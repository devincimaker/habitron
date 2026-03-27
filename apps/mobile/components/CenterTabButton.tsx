import { TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CENTER_TAB_BUTTON, type Colors } from '../constants/theme';
import { useThemedStyles, useColors } from '../hooks/useColors';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface CenterTabButtonProps {
  onPress: () => void;
}

export function CenterTabButton({
  onPress }: CenterTabButtonProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.button, animatedStyle]}
      activeOpacity={1}
    >
      <Feather name="plus" size={CENTER_TAB_BUTTON.iconSize} color={colors.white} />
    </AnimatedTouchable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  button: {
    width: CENTER_TAB_BUTTON.size,
    height: CENTER_TAB_BUTTON.size,
    borderRadius: CENTER_TAB_BUTTON.size / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
