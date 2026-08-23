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
import { SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, LIST_ITEM, STATUS_INDICATOR, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { getHabitIconAccentColor, resolveHabitIcon } from '../utils/habitIcons';
import { formatHabitProgress } from '../utils/habitSchedule';

interface HabitItemProps {
  habit: HabitWithStatus;
  onStatusChange: (habitId: string, status: HabitStatus) => void;
  /** Tap on the status circle or swipe right: one check-in (boolean toggle or quantity increment). */
  onCheckIn: (habit: HabitWithStatus) => void;
  onPress?: (habitId: string) => void;
}

const SWIPE_THRESHOLD = 80;

export function HabitItem({ habit, onStatusChange, onCheckIn, onPress }: HabitItemProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const translateX = useSharedValue(0);
  const habitIcon = resolveHabitIcon(habit.name, habit.icon);
  const habitIconColor = getHabitIconAccentColor(habitIcon) ?? colors.primary;
  const isQuantity = habit.goalType === 'quantity';
  const progress = isQuantity
    ? Math.min(1, habit.todayAmount / (habit.targetAmount ?? 1))
    : habit.todayStatus === 'completed'
      ? 1
      : 0;

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      onCheckIn(habit);
    } else {
      onStatusChange(habit.id, 'skipped');
    }
  };

  const handlePress = () => {
    onPress?.(habit.id);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
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

  const handleCheckIn = () => {
    onCheckIn(habit);
  };

  const checkInTap = Gesture.Tap().onEnd((_event, success) => {
    if (success) {
      runOnJS(handleCheckIn)();
    }
  });

  const tapGesture = Gesture.Tap()
    .requireExternalGestureToFail(checkInTap)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(handlePress)();
      }
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

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
        return colors.success;
      case 'skipped':
        return colors.skipped;
      default:
        return colors.primary;
    }
  };

  const renderStatusContent = () => {
    switch (habit.todayStatus) {
      case 'completed':
        return <Text style={[styles.statusIcon, { color: colors.success }]}>✓</Text>;
      case 'skipped':
        return <Text style={[styles.statusIcon, { color: colors.skipped }]}>✗</Text>;
      default:
        return <Ionicons name={habitIcon} size={18} color={habitIconColor} />;
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
          <GestureDetector gesture={checkInTap}>
            <View
              accessibilityRole="button"
              accessibilityLabel={`Check in ${habit.name}`}
              style={[
                styles.statusIndicator,
                habit.todayStatus !== 'pending' && {
                  borderColor: getStatusColor(),
                  borderWidth: STATUS_INDICATOR.borderWidth,
                },
              ]}
            >
              {renderStatusContent()}
            </View>
          </GestureDetector>
          <View style={styles.textContainer}>
            <Text style={[
              styles.habitName,
              habit.todayStatus === 'completed' && styles.completedText,
              habit.todayStatus === 'skipped' && styles.skippedText,
            ]}>
              {habit.name}
            </Text>
            {isQuantity ? (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                      habit.todayStatus === 'completed' && styles.progressFillDone,
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {formatHabitProgress(habit, habit.todayAmount)}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: LIST_ITEM.marginHorizontal,
    marginVertical: LIST_ITEM.marginVertical,
  },
  backgroundLeft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: SPACING.lg,
  },
  backgroundRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.skipped,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: SPACING.lg,
  },
  backgroundIcon: {
    color: colors.white,
    ...TYPOGRAPHY.displayMedium,
    fontWeight: 'bold',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
  },
  statusIndicator: {
    width: STATUS_INDICATOR.size,
    height: STATUS_INDICATOR.size,
    borderRadius: STATUS_INDICATOR.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    backgroundColor: colors.surface,
  },
  statusIcon: {
    ...TYPOGRAPHY.headingMedium,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  habitName: {
    ...TYPOGRAPHY.headingMedium,
    color: colors.text,
    fontWeight: '500',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  skippedText: {
    color: colors.textLight,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressFillDone: {
    backgroundColor: colors.success,
  },
  progressLabel: {
    ...TYPOGRAPHY.caption,
    color: colors.textSecondary,
  },
});
