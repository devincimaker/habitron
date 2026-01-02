import { useEffect, useRef } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/useAuthStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useAppStateHandler } from '../hooks/useAppState';
import { COLORS } from '../constants/theme';
import {
  registerForPushNotifications,
  savePushToken,
  addNotificationResponseListener,
} from '../services/notifications';

export default function RootLayout() {
  const { session, isInitialized, initialize } = useAuthStore();
  const loadHabits = useHabitsStore((state) => state.loadHabits);
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Handle app state changes for session timeout
  useAppStateHandler();

  // Initialize auth on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load habits and register for push notifications when authenticated
  useEffect(() => {
    if (session) {
      loadHabits();

      // Register for push notifications
      registerForPushNotifications().then((token) => {
        if (token) {
          savePushToken(token);
        }
      });
    }
  }, [session, loadHabits]);

  // Handle notification responses (deep linking when user taps notification)
  useEffect(() => {
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;

      // Handle coaching session notification
      if (data?.action === 'start_coaching') {
        // Only navigate if navigation is ready
        if (navigationState?.key) {
          router.push('/(tabs)/coach?autoStart=true');
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
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
