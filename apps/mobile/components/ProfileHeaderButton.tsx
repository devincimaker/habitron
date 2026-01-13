import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Avatar } from './ui';
import { useAuthStore } from '../stores/useAuthStore';
import { COLORS, HEADER, SPACING } from '../constants/theme';

export function ProfileHeaderButton() {
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
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Avatar
        text={user?.email || '?'}
        size="sm"
        backgroundColor={COLORS.primary}
        textColor={COLORS.white}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEADER.height,
    marginRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
