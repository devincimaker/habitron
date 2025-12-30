import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { HabitWithStatus, HabitStatus } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface HabitItemProps {
  habit: HabitWithStatus;
  onStatusChange: (habitId: string, status: HabitStatus) => void;
}

const SWIPE_THRESHOLD = 80;

export function HabitItem({ habit, onStatusChange }: HabitItemProps) {
  const translateX = useSharedValue(0);

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      // Right swipe: toggle between completed and pending
      const newStatus = habit.todayStatus === 'completed' ? 'pending' : 'completed';
      onStatusChange(habit.id, newStatus);
    } else {
      // Left swipe: mark as skipped
      onStatusChange(habit.id, 'skipped');
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const rightBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const getStatusIcon = () => {
    switch (habit.todayStatus) {
      case 'completed':
        return '✓';
      case 'skipped':
        return '✗';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (habit.todayStatus) {
      case 'completed':
        return COLORS.success;
      case 'skipped':
        return COLORS.skipped;
      default:
        return COLORS.border;
    }
  };

  return (
    <View style={styles.container}>
      {/* Background indicators */}
      <Animated.View style={[styles.backgroundLeft, leftBackgroundStyle]}>
        <Text style={styles.backgroundIcon}>✓</Text>
      </Animated.View>
      <Animated.View style={[styles.backgroundRight, rightBackgroundStyle]}>
        <Text style={styles.backgroundIcon}>✗</Text>
      </Animated.View>

      {/* Main content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={[styles.statusIndicator, { borderColor: getStatusColor() }]}>
            <Text style={[styles.statusIcon, { color: getStatusColor() }]}>
              {getStatusIcon()}
            </Text>
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
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
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
    fontSize: FONT_SIZES.xl,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  statusIcon: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  habitName: {
    fontSize: FONT_SIZES.md,
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
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});
