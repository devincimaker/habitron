import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/useAuthStore';
import { useProfileStore } from '../stores/useProfileStore';
import { resolveLaunchDecision } from '../utils/launchRoute';
import { FONT_SIZES, SPACING, BORDER_RADIUS, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const SPLASH_DELAY_MS = 1500;

export default function SplashScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const { session, isInitialized: authInitialized } = useAuthStore();
  const { name, loadStatus, loadProfile } = useProfileStore();

  const decision = resolveLaunchDecision({
    authInitialized,
    hasSession: !!session,
    profileStatus: loadStatus,
    hasName: !!name,
  });
  const targetRoute = decision.kind === 'navigate' ? decision.route : null;

  useEffect(() => {
    if (!targetRoute) return;
    const timer = setTimeout(() => router.replace(targetRoute), SPLASH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [targetRoute, router]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Habits Coach</Text>
          <Text style={styles.subtitle}>Get started with Thrive Coach</Text>
          {decision.kind === 'error' ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Couldn't load your profile. Check your connection and try again.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ActivityIndicator
              color={colors.white}
              style={styles.loader}
              size="small"
            />
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
    color: colors.white,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: colors.white,
    opacity: 0.9,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  errorContainer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  retryText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: colors.white,
  },
});
