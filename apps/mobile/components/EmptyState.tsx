import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../stores/useSessionStore';
import { Button, DisplayMedium, BodyMedium } from './ui';
import { SPACING, TAB_BAR } from '../constants/theme';

export function EmptyState() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isActive, startSession } = useSessionStore();

  const handleStartCoaching = () => {
    // Prevent duplicate session screens from rapid taps
    if (isActive) return;

    startSession();
    router.push('/session');
  };

  return (
    <View style={[styles.container, { paddingBottom: TAB_BAR.height + insets.bottom }]}>
      <Text style={styles.icon}>🌱</Text>
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
    paddingHorizontal: SPACING.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  title: {
    marginBottom: SPACING.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
});
