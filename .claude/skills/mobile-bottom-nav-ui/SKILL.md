---
name: mobile-bottom-nav-design
description: Design and implementation guide for bottom navigation bars in React Native + Expo mobile apps. Use when creating, styling, or reviewing bottom tab navigation. Covers icon sizing, typography, tap areas, active/inactive states, safe areas, contrast, animations, and visual separation patterns.
---

# React Native Bottom Navigation Design

Design specifications for bottom tab navigation in React Native + Expo apps.

## Core Specifications

| Element          | Value                           |
| ---------------- | ------------------------------- |
| Icon size        | 24px                            |
| Label font size  | 12px                            |
| Minimum tap area | 44px × 44px                     |
| Tab count        | 3–5 items (never fewer or more) |

## Icons

Use `@expo/vector-icons` with **Ionicons**.

```tsx
import { Ionicons } from "@expo/vector-icons";
```

**State styles:**

- **Inactive:** Outlined variant (e.g., `home-outline`), reduced opacity (0.6–0.7)
- **Active:** Filled variant (e.g., `home`), full opacity (1.0)

Naming pattern: `[name]-outline` for inactive, `[name]` for active.

Common navigation icons:

- Home: `home-outline` / `home`
- Search: `search-outline` / `search`
- Add: `add-circle-outline` / `add-circle`
- Notifications: `notifications-outline` / `notifications`
- Profile: `person-outline` / `person`
- Settings: `settings-outline` / `settings`

**Icon rules:**

- Use one consistent icon style (outlined) for all inactive tabs
- Never add boxes, circles, or backgrounds around icons
- Ensure sufficient contrast against the nav bar background (WCAG AA: 4.5:1 minimum)

## Labels

- Font size: 12px
- **Inactive:** Regular weight, reduced opacity (match icon opacity)
- **Active:** Semi-bold/medium weight (500–600), full opacity, darker color

Labels should always be visible (not hidden until active).

## Layout & Safe Areas

Handle safe areas for both iOS (notch, home indicator) and Android (gesture navigation):

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

// Apply to tab bar style
tabBarStyle: {
  paddingBottom: insets.bottom,
  height: 56 + insets.bottom,
}
```

The nav bar must never overlap with the iOS home indicator or Android gesture area.

## Visual Separation

Separate the bottom nav from main content using one of these methods:

1. **Border:** 1px top border with subtle color (e.g., `#E5E5E5`)
2. **Shadow:** Subtle elevation shadow
   ```tsx
   shadowColor: '#000',
   shadowOffset: { width: 0, height: -1 },
   shadowOpacity: 0.05,
   shadowRadius: 4,
   elevation: 5,
   ```
3. **Background contrast:** Nav bar slightly different from content background

**Color consistency:** Use the same background color for top navigation/header and bottom navigation.

## Animations & Micro-interactions

Good animations make navigation feel responsive and polished. Focus on two areas: tap feedback and screen transitions.

### Tap Feedback

Give immediate visual response when users tap a tab:

**Scale animation** (recommended):

```tsx
import { Pressable, Animated } from "react-native";

function TabBarButton({ children, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

**Timing guidelines:**

- Press in: immediate (spring animation, no delay)
- Press out: 100–150ms to settle back
- Use `useNativeDriver: true` for 60fps performance

**Alternative feedback options:**

- Opacity fade: 1.0 → 0.7 on press (simpler, less engaging)
- Background highlight: subtle color fill behind icon on press
- Haptic feedback: pair with `expo-haptics` for tactile response

```tsx
import * as Haptics from "expo-haptics";

// Light tap feedback
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

### Icon State Transitions

Animate the icon change between inactive and active states:

```tsx
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

function AnimatedTabIcon({ focused, activeIcon, inactiveIcon }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.1 : 1, { damping: 15 }) }],
    opacity: withSpring(focused ? 1 : 0.6, { damping: 20 }),
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={24}
        color={focused ? "#000" : "rgba(0,0,0,0.6)"}
      />
    </Animated.View>
  );
}
```

**Icon transition effects:**

- Slight scale bump (1.0 → 1.1) on active
- Smooth opacity transition (0.6 → 1.0)
- Duration: 200–300ms
- Use spring animations for organic feel

### Screen Transitions

Make tab switches feel smooth, not jarring:

**Fade transition** (subtle, professional):

```tsx
<Tab.Navigator
  screenOptions={{
    tabBarStyle: { /* ... */ },
    animation: 'fade',
  }}
>
```

**Shift transition** (slight horizontal movement):

```tsx
<Tab.Navigator
  screenOptions={{
    animation: 'shift',
  }}
>
```

**Custom transition with Reanimated:**

```tsx
import { FadeIn, FadeOut } from "react-native-reanimated";

function ScreenWrapper({ children }) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      {children}
    </Animated.View>
  );
}
```

**Transition guidelines:**

- Duration: 150–250ms (fast enough to feel snappy, slow enough to be visible)
- Prefer fade or subtle slide over dramatic effects
- Avoid: slide-from-side (feels like stack navigation), zoom, flip
- Keep consistent across all tabs
- Content should feel like it's "appearing in place," not traveling from somewhere

### Animation Dos and Don'ts

**Do:**

- Use spring animations for natural, organic motion
- Keep durations short (100–300ms)
- Combine scale + opacity for richer feedback
- Add haptics on iOS for premium feel
- Use `useNativeDriver` or Reanimated for performance

**Don't:**

- Add bounce/elastic effects (feels childish)
- Use long durations (>400ms feels sluggish)
- Animate too many properties at once
- Use different transition styles per tab
- Block interaction during animations

## Contrast Requirements

All elements must maintain sufficient contrast:

- Icon to background: minimum 4.5:1 ratio (WCAG AA)
- Label to background: minimum 4.5:1 ratio
- Active state should be clearly distinguishable from inactive (not just color—use weight/opacity)
- Test with accessibility tools to verify contrast ratios

## Implementation Example

```tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();

function BottomNav() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home: focused ? "home" : "home-outline",
            Search: focused ? "search" : "search-outline",
            Profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={icons[route.name]} size={24} color={color} />;
        },
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "rgba(0, 0, 0, 0.6)",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: focused ? "600" : "400",
        },
        tabBarStyle: {
          paddingBottom: insets.bottom,
          height: 56 + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: "#E5E5E5",
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```

## Checklist

Before finalizing bottom navigation:

- [ ] 3–5 tabs only
- [ ] Icons are 24px
- [ ] Labels are 12px
- [ ] Tap areas are at least 44px
- [ ] Outlined icons for inactive, filled for active
- [ ] Inactive elements have reduced opacity with sufficient contrast
- [ ] Active labels are bolder/darker
- [ ] Safe areas respected on iOS and Android
- [ ] Visual separation from content (border, shadow, or background)
- [ ] Top and bottom nav colors match
- [ ] Tap feedback present (scale or opacity animation)
- [ ] Icon state transitions are smooth (200–300ms)
- [ ] Screen transitions are subtle and consistent (fade or shift)
- [ ] All animations use native driver for performance
- [ ] No unnecessary decorations around icons
