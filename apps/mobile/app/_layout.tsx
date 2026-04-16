import { useEffect, useRef } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/useAuthStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useSessionStore } from '../stores/useSessionStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';
import { useAppStateHandler } from '../hooks/useAppState';
import { ColorsProvider, useColorsValue } from '../hooks/useColors';
import {
  registerForPushNotifications,
  savePushToken,
  addNotificationResponseListener,
} from '../services/notifications';
import * as Sentry from '@sentry/react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

Sentry.init({
  dsn: 'https://62fb18b511d16479fcc57e32f34cbf24@o4509554140577792.ingest.de.sentry.io/4510715469561936',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function RootLayout() {
  const colors = useColorsValue();
  const { session, isInitialized, initialize } = useAuthStore();
  const loadHabits = useHabitsStore((state) => state.loadHabits);
  const clearHabits = useHabitsStore((state) => state.clearHabits);
  const loadGoals = useGoalsStore((state) => state.loadGoals);
  const clearGoals = useGoalsStore((state) => state.clearGoals);
  const loadTodos = useTodosStore((state) => state.loadTodos);
  const clearTodos = useTodosStore((state) => state.clearTodos);
  const loadEntries = useJournalStore((state) => state.loadEntries);
  const clearEntries = useJournalStore((state) => state.clearEntries);
  const clearPlans = useDailyPlansStore((state) => state.clearPlans);
  const { loadProfile, reset: resetProfile } = useProfileStore();
  const isSessionActive = useSessionStore((state) => state.isActive);
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isSessionActiveRef = useRef(isSessionActive);
  isSessionActiveRef.current = isSessionActive;

  // Handle app state changes for session timeout
  useAppStateHandler();

  // Initialize auth on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load data and register for push notifications when authenticated
  useEffect(() => {
    if (session) {
      loadHabits();
      loadGoals();
      loadTodos();
      loadEntries();
      loadProfile();

      // Register for push notifications
      registerForPushNotifications().then((token) => {
        if (token) {
          savePushToken(token);
        }
      });
    } else {
      // Reset profile state on sign out
      clearHabits();
      clearGoals();
      clearTodos();
      clearEntries();
      clearPlans();
      resetProfile();
    }
  }, [
    session,
    clearEntries,
    clearGoals,
    clearHabits,
    clearPlans,
    clearTodos,
    loadEntries,
    loadGoals,
    loadHabits,
    loadProfile,
    loadTodos,
    resetProfile,
  ]);

  // Handle notification responses (deep linking when user taps notification)
  useEffect(() => {
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;

      // Handle coaching session notification
      if (data?.action === 'start_coaching') {
        // Only navigate if navigation is ready and no session is already active
        if (navigationState?.key && !isSessionActiveRef.current) {
          router.push('/session?autoStart=true');
        }
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router, navigationState?.key]);

  return (
    <ColorsProvider value={colors}>
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style={colors.background === '#FFFFFF' ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="profile"
            options={{
              title: 'Profile',
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="session"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              gestureEnabled: false, // Prevent accidental swipe dismiss
            }}
          />
        </Stack>
      </GestureHandlerRootView>
    </ColorsProvider>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
