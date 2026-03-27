import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CustomTabBar } from '../../components/CustomTabBar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { useSessionStore } from '../../stores/useSessionStore';
import { COLORS } from '../../constants/theme';

export const unstable_settings = {
  initialRouteName: 'today',
};

export default function TabLayout() {
  const { isActive, startSession } = useSessionStore();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props as any} />}
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
        name="coach"
        options={{
          title: 'Coach',
          headerTitle: 'Coach',
        }}
        listeners={{
          tabPress: () => {
            if (!isActive) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              startSession();
            }
          },
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
      {/* Hidden screens */}
      <Tabs.Screen
        name="diary"
        options={{
          href: null,
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
          href: null,
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
