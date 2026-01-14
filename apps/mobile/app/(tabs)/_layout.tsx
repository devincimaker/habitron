import { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CustomTabBar } from '../../components/CustomTabBar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { useSessionStore } from '../../stores/useSessionStore';
import { COLORS } from '../../constants/theme';

export default function TabLayout() {
  const router = useRouter();
  const { isActive, startSession } = useSessionStore();

  const handleNewSession = useCallback(() => {
    // Prevent duplicate session screens from rapid taps
    // startSession() has its own guard, but we also need to guard navigation
    if (isActive) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startSession();
    router.push('/session');
  }, [isActive, startSession, router]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props as any} onNewSession={handleNewSession} />}
      screenOptions={{
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerRight: () => <ProfileHeaderButton />,
        animation: 'fade',
      }}
    >
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          headerTitle: 'My Habits',
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          headerTitle: 'Sessions',
        }}
      />
      {/* Hide old screens that are no longer tabs */}
      <Tabs.Screen
        name="coach"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    color: COLORS.text,
    fontWeight: '600',
  },
});
