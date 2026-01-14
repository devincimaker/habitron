import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../stores/useSessionStore';
import { Button, DisplayMedium, BodyMedium } from './ui';
import { COLORS, SPACING } from '../constants/theme';

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
      <DisplayMedium style={styles.title}>No habits yet</DisplayMedium>
      <BodyMedium style={styles.subtitle}>
        Go talk to Habitron to add your first habit
      </BodyMedium>
      <Button
        title="Start Coaching Session"
        onPress={handleStartCoaching}
        size="lg"
      />
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
    marginBottom: SPACING.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
});
