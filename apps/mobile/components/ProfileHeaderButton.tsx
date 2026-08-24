import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Avatar } from './ui';
import { useAuthStore } from '../stores/useAuthStore';
import {
  HEADER,
  HEADER_CONTROL_HIT_SLOP,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

export function ProfileHeaderButton() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const { user } = useAuthStore();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/profile');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      hitSlop={HEADER_CONTROL_HIT_SLOP}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Avatar
        text={user?.email || '?'}
        size="sm"
        backgroundColor={colors.primary}
        textColor={colors.white}
        textStyle={styles.initial}
      />
    </TouchableOpacity>
  );
}

const createStyles = (_colors: Colors) => StyleSheet.create({
  container: {
    marginRight: HEADER.edgeMargin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontSize: 13,
    fontWeight: '600',
  },
});
