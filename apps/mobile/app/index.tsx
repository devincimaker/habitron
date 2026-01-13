import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/useAuthStore';
import { useProfileStore } from '../stores/useProfileStore';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { session, isInitialized: authInitialized } = useAuthStore();
  const { name, isInitialized: profileInitialized } = useProfileStore();

  // Navigate once auth and profile are ready
  useEffect(() => {
    if (!authInitialized) return;

    // No session - go to login
    if (!session) {
      const timer = setTimeout(() => router.replace('/(auth)/login'), 1500);
      return () => clearTimeout(timer);
    }

    // Wait for profile to load (triggered by _layout.tsx when session exists)
    if (!profileInitialized) return;

    // Navigate based on profile state
    const destination = name ? '/(tabs)/habits' : '/(onboarding)/name';
    const timer = setTimeout(() => router.replace(destination), 1500);
    return () => clearTimeout(timer);
  }, [authInitialized, session, profileInitialized, name, router]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Habits Coach</Text>
          <Text style={styles.subtitle}>Build better habits with Sage</Text>
          <ActivityIndicator
            color={COLORS.white}
            style={styles.loader}
            size="small"
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    opacity: 0.9,
  },
  loader: {
    marginTop: SPACING.xl,
  },
});
