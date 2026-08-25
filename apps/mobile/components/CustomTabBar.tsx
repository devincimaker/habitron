import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TAB_BAR, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { HOLD_MS } from '../utils/instruct';
import { CoachTabGlyph } from './CoachTabGlyph';
import { useInstruct, type InstructHold } from './InstructProvider';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  tasks: { active: 'checkbox', inactive: 'checkbox-outline' },
  calendar: { active: 'calendar', inactive: 'calendar-outline' },
  coach: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  habits: { active: 'repeat', inactive: 'repeat-outline' },
  journal: { active: 'book', inactive: 'book-outline' },
};

/** The one tab that answers a hold as well as a tap. */
const HOLD_TAB = 'coach';
/** How far the finger may travel during a hold before the gesture gives up. */
const HOLD_MAX_DISTANCE = 400;

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
  // Every hook runs before the early return below: a route with no icon entry
  // would otherwise change this component's hook count between renders.
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.6, { duration: 150 }),
  }));

  const icons = TAB_ICONS[routeName];
  if (!icons) return null;

  const iconName = focused ? icons.active : icons.inactive;

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={iconName} size={TAB_BAR.iconSize} color={color} />
    </Animated.View>
  );
}

const noop = () => {};

// Tab button with press animation; with `hold`, a long press records instead of navigating
function TabButton({
  children,
  onPress,
  isActive,
  hold,
}: {
  children: React.ReactNode;
  onPress: () => void;
  isActive: boolean;
  hold?: InstructHold;
}) {
  const [styles] = useThemedStyles(createStyles);
  const scale = useSharedValue(1);
  const holdStartY = useRef(0);
  const holdActive = useRef(false);

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

  // Callbacks run on the JS thread (runOnJS): they only forward to the provider.
  const holdGesture = Gesture.LongPress()
    .minDuration(HOLD_MS)
    .maxDistance(HOLD_MAX_DISTANCE)
    .runOnJS(true)
    .onTouchesDown((event) => {
      holdStartY.current = event.allTouches[0]?.absoluteY ?? 0;
    })
    .onStart(() => {
      holdActive.current = true;
      hold?.start();
    })
    .onTouchesMove((event) => {
      if (!holdActive.current) return;
      const y = event.allTouches[0]?.absoluteY ?? holdStartY.current;
      hold?.move(holdStartY.current - y);
    })
    // onFinalize fires on every terminal transition, with the same `success`
    // onEnd would get: false when the press was cancelled rather than released
    // — a second finger, the app backgrounding, travel past maxDistance.
    .onFinalize((_event, success) => {
      if (!holdActive.current) return;
      holdActive.current = false;
      hold?.end(success);
    });

  const button = (
    <Pressable
      onPress={onPress}
      // A fired long press suppresses onPress, so a hold never also opens the hub.
      onLongPress={hold ? noop : undefined}
      delayLongPress={HOLD_MS}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityHint={hold ? 'Hold to speak an instruction' : undefined}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );

  return hold ? <GestureDetector gesture={holdGesture}>{button}</GestureDetector> : button;
}

export function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const instruct = useInstruct();

  const visibleRoutes = state.routes.filter(route => TAB_ICONS[route.name]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBarBackground} />

      <View style={styles.tabsContainer}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const actualIndex = state.routes.findIndex(r => r.key === route.key);
          const isFocused = state.index === actualIndex;
          const color = isFocused ? colors.primary : colors.textSecondary;
          const isHoldTab = route.name === HOLD_TAB;

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
            <TabButton
              key={route.key}
              onPress={onPress}
              isActive={isFocused}
              hold={isHoldTab ? instruct.hold : undefined}
            >
              {isHoldTab ? (
                <CoachTabGlyph state={instruct.state} focused={isFocused} color={color} />
              ) : (
                <AnimatedTabIcon focused={isFocused} routeName={route.name} color={color} />
              )}
              <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </TabButton>
          );
        })}
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
});
