import { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CustomTabBar } from '../../components/CustomTabBar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { useSessionStore } from '../../stores/useSessionStore';
import { type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

export const unstable_settings = {
  initialRouteName: 'today',
};

export default function TabLayout() {
  const [styles] = useThemedStyles(createStyles);
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
        name="today"
        options={{
          title: 'Today',
          headerTitle: 'Today',
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          headerTitle: 'Tasks',
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          headerTitle: 'Habits',
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          headerTitle: 'Journal',
        }}
      />
      {/* Hide old screens that are no longer tabs */}
      <Tabs.Screen
        name="diary"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Coach History',
          headerTitle: 'Coach History',
          href: null,
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

const createStyles = (colors: Colors) => StyleSheet.create({
  header: {
    backgroundColor: colors.background,
  },
  headerTitle: {
    color: colors.text,
    fontWeight: '600',
  },
});
