import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useAppStateHandler } from '../hooks/useAppState';
import { COLORS } from '../constants/theme';

export default function RootLayout() {
  const { session, isInitialized, initialize } = useAuthStore();
  const loadHabits = useHabitsStore((state) => state.loadHabits);

  // Handle app state changes for session timeout
  useAppStateHandler();

  // Initialize auth on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load habits when user is authenticated
  useEffect(() => {
    if (session) {
      loadHabits();
    }
  }, [session, loadHabits]);

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
