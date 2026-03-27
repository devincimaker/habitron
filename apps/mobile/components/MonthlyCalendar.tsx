import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { HabitStatus, getTodayDate } from '@habits-coach/shared';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, type Colors } from '../constants/theme';
import {
  getMonthInfo,
  getMonthDisplayString,
  toDateString,
} from '../utils/dateUtils';
import { useThemedStyles, useColors } from '../hooks/useColors';

interface MonthlyCalendarProps {
  year: number;
  month: number;
  logs: Map<string, HabitStatus>;
  habitCreatedAt: number;
  onDayPress: (date: string, currentStatus: HabitStatus | undefined) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SIZE = 44;
const SWIPE_THRESHOLD = 50;

export function MonthlyCalendar({ year,
  month,
  logs,
  habitCreatedAt,
  onDayPress,
  onPreviousMonth,
  onNextMonth,
  canGoBack,
  canGoForward,
}: MonthlyCalendarProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const monthInfo = getMonthInfo(year, month);
  const displayString = getMonthDisplayString(year, month);

  const todayStr = getTodayDate();

  const createdDate = new Date(habitCreatedAt);
  const createdDateStr = toDateString(
    createdDate.getFullYear(),
    createdDate.getMonth() + 1,
    createdDate.getDate()
  );

  // Swipe gesture for month navigation
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD && canGoBack) {
        runOnJS(onPreviousMonth)();
      } else if (event.translationX < -SWIPE_THRESHOLD && canGoForward) {
        runOnJS(onNextMonth)();
      }
    });

  // Generate calendar grid (memoized to avoid recreating 30+ DayCell nodes)
  const days = useMemo(() => {
    const result: React.ReactNode[] = [];

    // Empty cells for days before month starts
    for (let i = 0; i < monthInfo.firstDayOfWeek; i++) {
      result.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Actual days
    for (let day = 1; day <= monthInfo.daysInMonth; day++) {
      const dateStr = toDateString(year, month + 1, day);
      const status = logs.get(dateStr);
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      const isBeforeCreated = dateStr < createdDateStr;
      const isDisabled = isFuture || isBeforeCreated;

      result.push(
        <DayCell
          key={dateStr}
          day={day}
          dateStr={dateStr}
          status={status}
          isToday={isToday}
          isDisabled={isDisabled}
          onPress={() => !isDisabled && onDayPress(dateStr, status)}
        />
      );
    }

    return result;
  }, [year, month, logs, todayStr, createdDateStr, monthInfo, onDayPress, styles]);

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        {/* Header with navigation */}
        <View style={styles.header}>
          <Pressable
            onPress={onPreviousMonth}
            disabled={!canGoBack}
            style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
            testID="prev-month-button"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={canGoBack ? colors.text : colors.textLight}
            />
          </Pressable>

          <Text style={styles.monthTitle}>{displayString}</Text>

          <Pressable
            onPress={onNextMonth}
            disabled={!canGoForward}
            style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
            testID="next-month-button"
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={canGoForward ? colors.text : colors.textLight}
            />
          </Pressable>
        </View>

        {/* Weekday labels */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.daysGrid}>{days}</View>
      </View>
    </GestureDetector>
  );
}

// Individual day cell component
function DayCell({
  day,
  dateStr,
  status,
  isToday,
  isDisabled,
  onPress,
}: {
  day: number;
  dateStr: string;
  status: HabitStatus | undefined;
  isToday: boolean;
  isDisabled: boolean;
  onPress: () => void; }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.9);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const getBackgroundStyle = () => {
    if (status === 'completed') {
      return { backgroundColor: colors.primary };
    }
    if (isToday) {
      return { borderWidth: 2, borderColor: colors.primary };
    }
    return {};
  };

  const getTextStyle = () => {
    if (status === 'completed') {
      return { color: colors.white };
    }
    if (isDisabled) {
      return { color: colors.textLight };
    }
    return { color: colors.text };
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={styles.dayCell}
      testID={`day-cell-${dateStr}`}
    >
      <Animated.View
        style={[styles.dayCircle, getBackgroundStyle(), animatedStyle]}
      >
        {status === 'skipped' ? (
          <Text style={[styles.dayText, { color: colors.skipped }]}>X</Text>
        ) : (
          <Text style={[styles.dayText, getTextStyle()]}>{day}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  navButton: {
    padding: SPACING.sm,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  monthTitle: {
    ...TYPOGRAPHY.headingLarge,
    color: colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  weekdayLabel: {
    width: DAY_SIZE,
    textAlign: 'center',
    ...TYPOGRAPHY.caption,
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.xs,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
});
