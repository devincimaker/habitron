import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/useAuthStore';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { session, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Small delay for splash effect
    const timer = setTimeout(() => {
      if (session) {
        router.replace('/(tabs)/habits');
      } else {
        router.replace('/(auth)/login');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isInitialized, session, router]);

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
