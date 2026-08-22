import { Tabs, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CustomTabBar } from '../../components/CustomTabBar';
import { ProfileHeaderButton } from '../../components/ProfileHeaderButton';
import { useSessionStore } from '../../stores/useSessionStore';
import { HEADER, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

export const unstable_settings = {
  initialRouteName: 'tasks',
};

export default function TabLayout() {
  const [styles] = useThemedStyles(createStyles);
  const router = useRouter();
  const { isActive, startSession } = useSessionStore();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props as any} />}
      // Work around react-navigation/react-navigation#12755: with a tab
      // `animation` set, react-native-screens can detach a newly mounted
      // scene mid-transition, leaving the screen blank until it is revisited.
      detachInactiveScreens={false}
      screenOptions={{
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerRight: () => <ProfileHeaderButton />,
        animation: 'fade',
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          headerTitle: 'Tasks',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerTitle: 'Calendar',
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          headerTitle: 'Coach',
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            if (!isActive) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              startSession();
            }
            router.push('/session');
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

const createStyles = (colors: Colors) => StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    // iOS hairline separator instead of the default shadow
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerTitle: {
    ...HEADER.title,
    color: colors.textStrong,
  },
});
