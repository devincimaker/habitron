import { Tabs } from 'expo-router';
import { StyleSheet, Pressable, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/theme';

const ICON_SIZE = 24;
const TAB_BAR_HEIGHT = 56;

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  habits: { active: 'checkmark-circle', inactive: 'checkmark-circle-outline' },
  coach: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

// Animated icon component with scale bump and opacity transition
function AnimatedTabIcon({
  focused,
  routeName,
  color,
}: {
  focused: boolean;
  routeName: string;
  color: string;
}) {
  const icons = TAB_ICONS[routeName];
  const iconName = focused ? icons.active : icons.inactive;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.1 : 1, { damping: 15 }) }],
    opacity: withSpring(focused ? 1 : 0.6, { damping: 20 }),
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={iconName} size={ICON_SIZE} color={color} />
    </Animated.View>
  );
}

// Custom tab bar button with tap feedback
function TabBarButton({
  children,
  onPress,
  accessibilityState,
}: {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  accessibilityState?: { selected?: boolean };
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <AnimatedTabIcon focused={focused} routeName={route.name} color={color} />
        ),
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text,
        tabBarStyle: {
          ...styles.tabBar,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        animation: 'fade',
      })}
    >
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          headerTitle: 'My Habits',
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          headerTitle: 'Coach Sage',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  tabItem: {
    minHeight: 44,
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    color: COLORS.text,
    fontWeight: '600',
  },
});
