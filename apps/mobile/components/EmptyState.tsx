import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../stores/useSessionStore';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../constants/theme';

export function EmptyState() {
  const router = useRouter();
  const startSession = useSessionStore((state) => state.startSession);

  const handleStartCoaching = () => {
    startSession();
    router.push('/(tabs)/coach');
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🌱</Text>
      </View>
      <Text style={styles.title}>No habits yet</Text>
      <Text style={styles.subtitle}>
        Go talk to Coach Sage to add your first habit
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleStartCoaching}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Start Coaching Session</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
