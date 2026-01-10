import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { HabitWithStatus, HabitStatus } from '@habits-coach/shared';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  TYPOGRAPHY,
  LIST_ITEM,
  STATUS_INDICATOR,
} from '../constants/theme';

const DEFAULT_HABIT_ICON = 'flash';

interface HabitItemProps {
  habit: HabitWithStatus;
  onStatusChange: (habitId: string, status: HabitStatus) => void;
  onLongPress?: (habitId: string) => void;
}

const SWIPE_THRESHOLD = 80;

export function HabitItem({ habit, onStatusChange, onLongPress }: HabitItemProps) {
  const translateX = useSharedValue(0);

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      const newStatus = habit.todayStatus === 'completed' ? 'pending' : 'completed';
      onStatusChange(habit.id, newStatus);
    } else {
      onStatusChange(habit.id, 'skipped');
    }
  };

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress(habit.id);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        runOnJS(handleSwipeComplete)('right');
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(handleSwipeComplete)('left');
      }
      translateX.value = withSpring(0);
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd((event, success) => {
      if (success) {
        runOnJS(handleLongPress)();
      }
    });

  const composedGesture = Gesture.Race(panGesture, longPressGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const rightBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const getStatusColor = () => {
    switch (habit.todayStatus) {
      case 'completed':
        return COLORS.success;
      case 'skipped':
        return COLORS.skipped;
      default:
        return COLORS.primary;
    }
  };

  const renderStatusContent = () => {
    switch (habit.todayStatus) {
      case 'completed':
        return <Text style={[styles.statusIcon, { color: COLORS.success }]}>✓</Text>;
      case 'skipped':
        return <Text style={[styles.statusIcon, { color: COLORS.skipped }]}>✗</Text>;
      default:
        // Show habit icon when pending
        const iconName = (habit.icon || DEFAULT_HABIT_ICON) as keyof typeof Ionicons.glyphMap;
        return <Ionicons name={iconName} size={18} color={COLORS.primary} />;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.backgroundLeft, leftBackgroundStyle]}>
        <Text style={styles.backgroundIcon}>✓</Text>
      </Animated.View>
      <Animated.View style={[styles.backgroundRight, rightBackgroundStyle]}>
        <Text style={styles.backgroundIcon}>✗</Text>
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={[
            styles.statusIndicator,
            habit.todayStatus !== 'pending' && { borderColor: getStatusColor(), borderWidth: STATUS_INDICATOR.borderWidth },
          ]}>
            {renderStatusContent()}
          </View>
          <View style={styles.textContainer}>
            <Text style={[
              styles.habitName,
              habit.todayStatus === 'completed' && styles.completedText,
              habit.todayStatus === 'skipped' && styles.skippedText,
            ]}>
              {habit.name}
            </Text>
            {habit.timeOfDay && habit.timeOfDay !== 'anytime' && (
              <Text style={styles.timeOfDay}>{habit.timeOfDay}</Text>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: LIST_ITEM.marginHorizontal,
    marginVertical: LIST_ITEM.marginVertical,
  },
  backgroundLeft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: SPACING.lg,
  },
  backgroundRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.skipped,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: SPACING.lg,
  },
  backgroundIcon: {
    color: COLORS.white,
    ...TYPOGRAPHY.displayMedium,
    fontWeight: 'bold',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  statusIndicator: {
    width: STATUS_INDICATOR.size,
    height: STATUS_INDICATOR.size,
    borderRadius: STATUS_INDICATOR.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  statusIcon: {
    ...TYPOGRAPHY.headingMedium,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  habitName: {
    ...TYPOGRAPHY.headingMedium,
    color: COLORS.text,
    fontWeight: '500',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  skippedText: {
    color: COLORS.textLight,
  },
  timeOfDay: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textLight,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});
