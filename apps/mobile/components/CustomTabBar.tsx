import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CenterTabButton } from './CenterTabButton';
import { TAB_BAR, CENTER_TAB_BUTTON, type Colors } from '../constants/theme';
import { useThemedStyles, useColors } from '../hooks/useColors';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  today: { active: 'today', inactive: 'today-outline' },
  tasks: { active: 'checkbox', inactive: 'checkbox-outline' },
  habits: { active: 'repeat', inactive: 'repeat-outline' },
  journal: { active: 'book', inactive: 'book-outline' },
};

interface CustomTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  onNewSession: () => void;
}

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
  if (!icons) return null;

  const iconName = focused ? icons.active : icons.inactive;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.6, { duration: 150 }),
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={iconName} size={TAB_BAR.iconSize} color={color} />
    </Animated.View>
  );
}

// Tab button with press animation
function TabButton({
  children,
  onPress,
  isActive,
}: {
  children: React.ReactNode;
  onPress: () => void;
  isActive: boolean;
}) {
  const [styles, colors] = useThemedStyles(createStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    alignItems: 'center' as const,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({
  state, descriptors, navigation, onNewSession }: CustomTabBarProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // Filter to only show routes that belong in the bottom navigation
  const visibleRoutes = state.routes.filter(route => TAB_ICONS[route.name]);
  const splitIndex = Math.ceil(visibleRoutes.length / 2);
  const leftRoutes = visibleRoutes.slice(0, splitIndex);
  const rightRoutes = visibleRoutes.slice(splitIndex);

  // Helper to render a tab
  const renderTab = (route: { key: string; name: string }) => {
    const { options } = descriptors[route.key];
    const label = options.title ?? route.name;
    const actualIndex = state.routes.findIndex(r => r.key === route.key);
    const isFocused = state.index === actualIndex;
    const color = isFocused ? colors.primary : colors.textSecondary;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TabButton key={route.key} onPress={onPress} isActive={isFocused}>
        <AnimatedTabIcon focused={isFocused} routeName={route.name} color={color} />
        <Text style={[styles.tabLabel, { color }]}>{label}</Text>
      </TabButton>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Tab bar background */}
      <View style={styles.tabBarBackground} />

      {/* Tab items container: Left Tab | Center Button | Right Tab */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabGroup}>
          {leftRoutes.map(renderTab)}
        </View>

        {/* Center button - floating half out */}
        <View style={styles.centerButtonContainer}>
          <CenterTabButton onPress={onNewSession} />
        </View>

        <View style={styles.tabGroup}>
          {rightRoutes.map(renderTab)}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR.height + 50, // Extra height to cover safe area
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: TAB_BAR.height,
    alignItems: 'center',
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabLabel: {
    fontSize: TAB_BAR.labelSize,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  centerButtonContainer: {
    width: CENTER_TAB_BUTTON.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
