import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Avatar } from './ui';
import { useAuthStore } from '../stores/useAuthStore';
import { HEADER, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles, useColors } from '../hooks/useColors';

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
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Avatar
        text={user?.email || '?'}
        size="sm"
        backgroundColor={colors.primary}
        textColor={colors.white}
      />
    </TouchableOpacity>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    height: HEADER.height,
    marginRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
