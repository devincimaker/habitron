import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getTodayDate } from '@habits-coach/shared';
import { SPACING, FONT_SIZES, TYPOGRAPHY, type Colors } from '../constants/theme';
import {
  get7DaysCenteredOn,
  getMonthInfo,
  getMonthDisplayString,
  getPreviousMonth,
  getNextMonth,
  getWeekRowIndex,
  toDateString,
} from '../utils/dateUtils';
import { useThemedStyles, useColors } from '../hooks/useColors';

// --- Types ---

interface TaskCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  taskDatesWithDots?: Set<string>;
}

export interface TaskCalendarRef {
  getDateAtPosition: (x: number, y: number) => string | null;
}

// --- Constants ---

const DAY_SIZE = 40;
const ROW_HEIGHT = DAY_SIZE + SPACING.sm;
const WEEKDAY_ROW_HEIGHT = 20;
const HEADER_HEIGHT = 44;
const COLLAPSED_PADDING = SPACING.sm;
const EXPANDED_PADDING = SPACING.md;
const SWIPE_THRESHOLD = 50;
const EXPAND_THRESHOLD = 40;
const DOT_SIZE = 5;

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const SPRING_CONFIG = { damping: 20, stiffness: 200 };

// --- Component ---

export const TaskCalendar = forwardRef<TaskCalendarRef, TaskCalendarProps>(
  function TaskCalendar({ selectedDate, onSelectDate, taskDatesWithDots }, ref) {
    const [styles, colors] = useThemedStyles(createStyles);
    const todayStr = getTodayDate();

    // --- State ---
    const [isExpanded, setIsExpanded] = useState(false);
    const [weekCenterDate, setWeekCenterDate] = useState(selectedDate);

    // Determine which month to display (from selected date)
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const [displayYear, setDisplayYear] = useState(selectedDateObj.getFullYear());
    const [displayMonth, setDisplayMonth] = useState(selectedDateObj.getMonth());

    // --- Shared values ---
    const expandProgress = useSharedValue(0);
    const [calendarWidth, setCalendarWidth] = useState(0);

    // --- Computed data ---
    const weekDays = useMemo(() => get7DaysCenteredOn(weekCenterDate), [weekCenterDate]);

    const monthInfo = useMemo(
      () => getMonthInfo(displayYear, displayMonth),
      [displayYear, displayMonth]
    );

    const monthTitle = useMemo(
      () => getMonthDisplayString(displayYear, displayMonth),
      [displayYear, displayMonth]
    );

    // Month for collapsed label (from center of week strip)
    const collapsedMonthLabel = useMemo(() => {
      const d = new Date(weekCenterDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [weekCenterDate]);

    const numRows = useMemo(() => {
      return Math.ceil((monthInfo.firstDayOfWeek + monthInfo.daysInMonth) / 7);
    }, [monthInfo]);

    const expandedHeight = HEADER_HEIGHT + WEEKDAY_ROW_HEIGHT + numRows * ROW_HEIGHT + EXPANDED_PADDING;
    const collapsedHeight = WEEKDAY_ROW_HEIGHT + ROW_HEIGHT + COLLAPSED_PADDING * 2 + 24; // 24 for month label

    // Row index of selected date in month grid
    const selectedRow = useMemo(() => {
      const d = new Date(selectedDate + 'T00:00:00');
      if (d.getFullYear() === displayYear && d.getMonth() === displayMonth) {
        return getWeekRowIndex(displayYear, displayMonth, d.getDate());
      }
      return 0;
    }, [selectedDate, displayYear, displayMonth]);

    // --- Callbacks ---

    const handleExpand = useCallback(() => {
      setIsExpanded(true);
      // Sync month to selected date when expanding
      const d = new Date(selectedDate + 'T00:00:00');
      setDisplayYear(d.getFullYear());
      setDisplayMonth(d.getMonth());
      expandProgress.value = withSpring(1, SPRING_CONFIG);
    }, [expandProgress, selectedDate]);

    const handleCollapse = useCallback(() => {
      setIsExpanded(false);
      // Re-center week on selected date when collapsing
      setWeekCenterDate(selectedDate);
      expandProgress.value = withSpring(0, SPRING_CONFIG);
    }, [expandProgress, selectedDate]);

    const handleWeekForward = useCallback(() => {
      // Advance by 7 days from current center
      const d = new Date(weekCenterDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      setWeekCenterDate(toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    }, [weekCenterDate]);

    const handleWeekBackward = useCallback(() => {
      const d = new Date(weekCenterDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      setWeekCenterDate(toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    }, [weekCenterDate]);

    const handleNextMonth = useCallback(() => {
      const next = getNextMonth(displayYear, displayMonth);
      setDisplayYear(next.year);
      setDisplayMonth(next.month);
    }, [displayYear, displayMonth]);

    const handlePreviousMonth = useCallback(() => {
      const prev = getPreviousMonth(displayYear, displayMonth);
      setDisplayYear(prev.year);
      setDisplayMonth(prev.month);
    }, [displayYear, displayMonth]);

    const handleDayPress = useCallback((dateStr: string) => {
      onSelectDate(dateStr);
    }, [onSelectDate]);

    // --- Gestures ---

    const horizontalPan = Gesture.Pan()
      .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
      .failOffsetY([-15, 15])
      .onEnd((event) => {
        if (event.translationX > SWIPE_THRESHOLD) {
          if (isExpanded) {
            runOnJS(handlePreviousMonth)();
          } else {
            runOnJS(handleWeekBackward)();
          }
        } else if (event.translationX < -SWIPE_THRESHOLD) {
          if (isExpanded) {
            runOnJS(handleNextMonth)();
          } else {
            runOnJS(handleWeekForward)();
          }
        }
      });

    const verticalPan = Gesture.Pan()
      .activeOffsetY([-EXPAND_THRESHOLD, EXPAND_THRESHOLD])
      .failOffsetX([-15, 15])
      .onEnd((event) => {
        if (!isExpanded && event.translationY > EXPAND_THRESHOLD) {
          runOnJS(handleExpand)();
        } else if (isExpanded && event.translationY < -EXPAND_THRESHOLD) {
          runOnJS(handleCollapse)();
        }
      });

    const composedGesture = Gesture.Race(verticalPan, horizontalPan);

    // --- Animated styles ---

    const containerAnimatedStyle = useAnimatedStyle(() => {
      const height = interpolate(
        expandProgress.value,
        [0, 1],
        [collapsedHeight, expandedHeight]
      );
      return { height };
    });

    const headerAnimatedStyle = useAnimatedStyle(() => ({
      opacity: expandProgress.value,
      height: interpolate(expandProgress.value, [0, 1], [0, HEADER_HEIGHT]),
    }));

    const collapsedLabelAnimatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0]),
      height: interpolate(expandProgress.value, [0, 0.3], [24, 0]),
    }));

    const gridTranslateStyle = useAnimatedStyle(() => {
      const translateY = interpolate(
        expandProgress.value,
        [0, 1],
        [-selectedRow * ROW_HEIGHT, 0]
      );
      return { transform: [{ translateY }] };
    });

    // --- Ref ---

    useImperativeHandle(ref, () => ({
      getDateAtPosition(x: number, y: number): string | null {
        if (calendarWidth === 0) return null;
        const cellWidth = calendarWidth / 7;
        const col = Math.floor(x / cellWidth);
        const adjustedY = isExpanded ? y - HEADER_HEIGHT - WEEKDAY_ROW_HEIGHT : y - 24 - WEEKDAY_ROW_HEIGHT;
        const row = Math.floor(adjustedY / ROW_HEIGHT);
        if (col < 0 || col > 6 || row < 0) return null;

        const dayIndex = row * 7 + col - monthInfo.firstDayOfWeek + 1;
        if (dayIndex < 1 || dayIndex > monthInfo.daysInMonth) return null;
        return toDateString(displayYear, displayMonth + 1, dayIndex);
      },
    }), [calendarWidth, isExpanded, monthInfo, displayYear, displayMonth]);

    // --- Layout ---

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      setCalendarWidth(event.nativeEvent.layout.width);
    }, []);

    // --- Month grid ---

    const monthGrid = useMemo(() => {
      const cells: React.ReactNode[] = [];

      // Empty cells before month starts
      for (let i = 0; i < monthInfo.firstDayOfWeek; i++) {
        cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
      }

      for (let day = 1; day <= monthInfo.daysInMonth; day++) {
        const dateStr = toDateString(displayYear, displayMonth + 1, day);
        cells.push(
          <DayCell
            key={dateStr}
            day={day}
            dateStr={dateStr}
            isSelected={dateStr === selectedDate}
            isToday={dateStr === todayStr}
            hasDot={taskDatesWithDots?.has(dateStr) ?? false}
            onPress={handleDayPress}
          />
        );
      }

      return cells;
    }, [displayYear, displayMonth, monthInfo, selectedDate, todayStr, taskDatesWithDots, handleDayPress, styles]);

    // --- Collapsed week cells ---

    const weekCells = useMemo(() => {
      return weekDays.map((day) => (
        <DayCell
          key={day.date}
          day={day.dayNumber}
          dateStr={day.date}
          isSelected={day.date === selectedDate}
          isToday={day.isToday}
          hasDot={taskDatesWithDots?.has(day.date) ?? false}
          onPress={handleDayPress}
        />
      ));
    }, [weekDays, selectedDate, taskDatesWithDots, handleDayPress]);

    // --- Render ---

    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[styles.container, containerAnimatedStyle]}
          onLayout={handleLayout}
        >
          {/* Collapsed month label */}
          <Animated.View style={[styles.collapsedLabelRow, collapsedLabelAnimatedStyle]}>
            <Text style={styles.collapsedLabel}>{collapsedMonthLabel}</Text>
          </Animated.View>

          {/* Expanded header with month navigation */}
          <Animated.View style={[styles.expandedHeader, headerAnimatedStyle]}>
            <Pressable onPress={handlePreviousMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Pressable onPress={handleNextMonth} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </Animated.View>

          {/* Weekday labels */}
          {isExpanded ? (
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, index) => (
                <Text key={`wd-${index}`} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.weekdayRow}>
              {weekDays.map((day, index) => (
                <Text key={`wd-${index}`} style={styles.weekdayLabel}>
                  {day.weekdayLetter}
                </Text>
              ))}
            </View>
          )}

          {/* Calendar body */}
          <View style={styles.bodyClip}>
            {isExpanded ? (
              <Animated.View style={[styles.daysGrid, gridTranslateStyle]}>
                {monthGrid}
              </Animated.View>
            ) : (
              <View style={styles.weekRow}>
                {weekCells}
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }
);

// --- DayCell ---

const DayCell = React.memo(function DayCell({
  day,
  dateStr,
  isSelected,
  isToday,
  hasDot,
  onPress,
}: {
  day: number;
  dateStr: string;
  isSelected: boolean;
  isToday: boolean;
  hasDot: boolean;
  onPress: (dateStr: string) => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const circleStyle = isSelected
    ? { backgroundColor: colors.primary }
    : isToday
    ? { borderWidth: 2, borderColor: colors.primary }
    : undefined;

  const textColor = isSelected ? colors.white : colors.text;

  return (
    <Pressable
      onPress={() => onPress(dateStr)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={dayCellStyles.cell}
    >
      <Animated.View
        style={[dayCellStyles.circle, circleStyle, animatedStyle]}
      >
        <Text style={[dayCellStyles.text, { color: textColor }]}>{day}</Text>
      </Animated.View>
      {hasDot ? (
        <View style={[dayCellStyles.dot, { backgroundColor: colors.primary }]} />
      ) : (
        <View style={dayCellStyles.dotPlaceholder} />
      )}
    </Pressable>
  );
});

const dayCellStyles = StyleSheet.create({
  cell: {
    width: `${100 / 7}%` as unknown as number,
    alignItems: 'center',
    paddingVertical: SPACING.xs / 2,
  },
  circle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginTop: 2,
  },
  dotPlaceholder: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    marginTop: 2,
  },
});

// --- Styles ---

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      overflow: 'hidden',
      paddingHorizontal: SPACING.sm,
    },
    collapsedLabelRow: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    collapsedLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    expandedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      overflow: 'hidden',
      paddingHorizontal: SPACING.xs,
    },
    navButton: {
      padding: SPACING.sm,
    },
    monthTitle: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.text,
    },
    weekdayRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      height: WEEKDAY_ROW_HEIGHT,
    },
    weekdayLabel: {
      width: `${100 / 7}%` as unknown as number,
      textAlign: 'center',
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    bodyClip: {
      overflow: 'hidden',
      flex: 1,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    weekRow: {
      flexDirection: 'row',
    },
    dayCell: {
      width: `${100 / 7}%` as unknown as number,
      height: ROW_HEIGHT,
    },
  });
