import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';

// Simple icon components (can be replaced with proper icons later)
function HabitsIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={[
        styles.iconContainer,
        { backgroundColor: focused ? COLORS.primary : 'transparent' },
      ]}
    >
      <View style={[styles.checkIcon, { borderColor: focused ? COLORS.white : COLORS.textLight }]}>
        {focused && <View style={styles.checkMark} />}
      </View>
    </View>
  );
}

function CoachIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={[
        styles.iconContainer,
        { backgroundColor: focused ? COLORS.primary : 'transparent' },
      ]}
    >
      <View style={[styles.coachIcon, { backgroundColor: focused ? COLORS.white : COLORS.textLight }]} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTitleStyle: {
          color: COLORS.text,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          headerTitle: 'My Habits',
          tabBarIcon: ({ focused }) => <HabitsIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          headerTitle: 'Coach Sage',
          tabBarIcon: ({ focused }) => <CoachIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xs,
    height: 80,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    width: 8,
    height: 4,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.white,
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  coachIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
