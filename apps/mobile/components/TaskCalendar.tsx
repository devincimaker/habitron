import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getTodayDate } from '@habits-coach/shared';
import { FONT_SIZES, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import {
  getWeekDaysStartingSunday,
  toDateString,
} from '../utils/dateUtils';
import {
  buildTaskCalendarMonthWeeks,
  getTaskCalendarDateAtPosition,
  getTaskCalendarHeights,
  getTaskCalendarNavigationTarget,
  type TaskCalendarFrame,
  type TaskCalendarMetrics,
} from '../utils/taskCalendar';
import { useColors, useThemedStyles } from '../hooks/useColors';

interface TaskCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  taskDatesWithDots?: Set<string>;
  dragHoverDate?: string | null;
}

export interface TaskCalendarRef {
  getDateAtScreenPosition: (screenX: number, screenY: number) => string | null;
}

const DAY_SIZE = 40;
const ROW_HEIGHT = DAY_SIZE + 4;
const WEEKDAY_ROW_HEIGHT = 20;
const CALENDAR_TOP_PADDING = SPACING.sm;
const CALENDAR_BOTTOM_PADDING = 4;
const SWIPE_THRESHOLD = 50;
const EXPAND_THRESHOLD = 40;
const DOT_SIZE = 5;
const ANIMATION_DURATION = 160;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIMING_CONFIG = {
  duration: ANIMATION_DURATION,
  easing: Easing.out(Easing.cubic),
};

function getDateParts(dateStr: string): { year: number; month: number; day: number } {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

const calendarMetrics: TaskCalendarMetrics = {
  topPadding: CALENDAR_TOP_PADDING,
  bottomPadding: CALENDAR_BOTTOM_PADDING,
  weekdayRowHeight: WEEKDAY_ROW_HEIGHT,
  rowHeight: ROW_HEIGHT,
};

export const TaskCalendar = forwardRef<TaskCalendarRef, TaskCalendarProps>(
  function TaskCalendar(
    { selectedDate, onSelectDate, taskDatesWithDots, dragHoverDate },
    ref
  ) {
    const [styles] = useThemedStyles(createStyles);
    const containerRef = useRef<View>(null);
    const todayStr = getTodayDate();
    const selectedDateObj = useMemo(
      () => new Date(selectedDate + 'T00:00:00'),
      [selectedDate]
    );

    const [isExpanded, setIsExpanded] = useState(false);
    const [renderExpandedBody, setRenderExpandedBody] = useState(false);
    const [displayYear, setDisplayYear] = useState(selectedDateObj.getFullYear());
    const [displayMonth, setDisplayMonth] = useState(selectedDateObj.getMonth());
    const [frame, setFrame] = useState<TaskCalendarFrame | null>(null);
    const expandProgress = useSharedValue(0);

    const weekDays = useMemo(() => getWeekDaysStartingSunday(selectedDate), [selectedDate]);
    const weekDates = useMemo(() => weekDays.map((day) => day.date), [weekDays]);
    const expandedWeeks = useMemo(
      () => buildTaskCalendarMonthWeeks(displayYear, displayMonth),
      [displayMonth, displayYear]
    );
    const { collapsedHeight, expandedHeight } = useMemo(
      () => getTaskCalendarHeights(expandedWeeks.length, calendarMetrics),
      [expandedWeeks.length]
    );

    const measureFrame = useCallback(() => {
      if (!containerRef.current) return;

      containerRef.current.measureInWindow((x, y, width, height) => {
        setFrame({ x, y, width, height });
      });
    }, []);

    useEffect(() => {
      if (isExpanded) return;
      setDisplayYear(selectedDateObj.getFullYear());
      setDisplayMonth(selectedDateObj.getMonth());
    }, [isExpanded, selectedDateObj]);

    useEffect(() => {
      const handle = requestAnimationFrame(measureFrame);
      return () => cancelAnimationFrame(handle);
    }, [expandedHeight, collapsedHeight, isExpanded, measureFrame]);

    const handleLayout = useCallback(
      (_event: LayoutChangeEvent) => {
        measureFrame();
      },
      [measureFrame]
    );

    const handleExpand = useCallback(() => {
      setDisplayYear(selectedDateObj.getFullYear());
      setDisplayMonth(selectedDateObj.getMonth());
      setRenderExpandedBody(true);
      setIsExpanded(true);
      expandProgress.value = withTiming(1, TIMING_CONFIG);
    }, [expandProgress, selectedDateObj]);

    const handleCollapse = useCallback(() => {
      setIsExpanded(false);
      expandProgress.value = withTiming(0, TIMING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(setRenderExpandedBody)(false);
        }
      });
    }, [expandProgress]);

    const handleWeekShift = useCallback(
      (direction: 1 | -1) => {
        const nextDate = new Date(selectedDate + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + direction * 7);
        onSelectDate(
          toDateString(
            nextDate.getFullYear(),
            nextDate.getMonth() + 1,
            nextDate.getDate()
          )
        );
      },
      [onSelectDate, selectedDate]
    );

    const handleMonthNavigation = useCallback(
      (direction: 'previous' | 'next') => {
        const target = getTaskCalendarNavigationTarget(
          displayYear,
          displayMonth,
          direction,
          todayStr
        );
        setDisplayYear(target.year);
        setDisplayMonth(target.month);
        onSelectDate(target.dateStr);
      },
      [displayMonth, displayYear, onSelectDate, todayStr]
    );

    const handleSelectDate = useCallback(
      (dateStr: string) => {
        onSelectDate(dateStr);

        if (!renderExpandedBody) return;

        const parts = getDateParts(dateStr);
        if (parts.year !== displayYear || parts.month !== displayMonth) {
          setDisplayYear(parts.year);
          setDisplayMonth(parts.month);
        }
      },
      [displayMonth, displayYear, onSelectDate, renderExpandedBody]
    );

    const horizontalPan = Gesture.Pan()
      .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
      .failOffsetY([-15, 15])
      .onEnd((event) => {
        if (event.translationX > SWIPE_THRESHOLD) {
          if (isExpanded) {
            runOnJS(handleMonthNavigation)('previous');
          } else {
            runOnJS(handleWeekShift)(-1);
          }
        } else if (event.translationX < -SWIPE_THRESHOLD) {
          if (isExpanded) {
            runOnJS(handleMonthNavigation)('next');
          } else {
            runOnJS(handleWeekShift)(1);
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

    const calendarGesture = Gesture.Race(verticalPan, horizontalPan);

    const containerAnimatedStyle = useAnimatedStyle(() => ({
      height: interpolate(expandProgress.value, [0, 1], [collapsedHeight, expandedHeight]),
    }));

    useImperativeHandle(
      ref,
      () => ({
        getDateAtScreenPosition(screenX: number, screenY: number) {
          return getTaskCalendarDateAtPosition({
            frame,
            screenX,
            screenY,
            isExpanded: renderExpandedBody,
            weekDates,
            expandedWeeks,
            metrics: calendarMetrics,
          });
        },
      }),
      [expandedWeeks, frame, renderExpandedBody, weekDates]
    );

    const renderedExpandedWeeks = useMemo(
      () =>
        expandedWeeks.map((week, rowIndex) => (
          <View key={`expanded-week-${rowIndex}`} style={styles.weekRow}>
            {week.map((cell) => (
              <DayCell
                key={cell.dateStr}
                dateStr={cell.dateStr}
                day={cell.day}
                isSelected={cell.dateStr === selectedDate}
                isToday={cell.dateStr === todayStr}
                isOutsideMonth={!cell.isCurrentMonth}
                hasDot={taskDatesWithDots?.has(cell.dateStr) ?? false}
                isDropTarget={dragHoverDate === cell.dateStr}
                onPress={handleSelectDate}
              />
            ))}
          </View>
        )),
      [
        dragHoverDate,
        expandedWeeks,
        handleSelectDate,
        selectedDate,
        styles.weekRow,
        taskDatesWithDots,
        todayStr,
      ]
    );

    const collapsedWeekCells = useMemo(
      () =>
        weekDays.map((day) => (
          <DayCell
            key={day.date}
            dateStr={day.date}
            day={day.dayNumber}
            isSelected={day.date === selectedDate}
            isToday={day.isToday}
            isOutsideMonth={false}
            hasDot={taskDatesWithDots?.has(day.date) ?? false}
            isDropTarget={dragHoverDate === day.date}
            onPress={handleSelectDate}
          />
        )),
      [dragHoverDate, handleSelectDate, selectedDate, taskDatesWithDots, weekDays]
    );

    return (
      <GestureDetector gesture={calendarGesture}>
        <Animated.View
          ref={containerRef}
          onLayout={handleLayout}
          style={[styles.container, containerAnimatedStyle]}
        >
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.bodyClip}>
            {renderExpandedBody ? (
              <View>{renderedExpandedWeeks}</View>
            ) : (
              <View style={styles.weekRow}>{collapsedWeekCells}</View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }
);

const DayCell = React.memo(function DayCell({
  dateStr,
  day,
  isSelected,
  isToday,
  isOutsideMonth,
  hasDot,
  isDropTarget,
  onPress,
}: {
  dateStr: string;
  day: number;
  isSelected: boolean;
  isToday: boolean;
  isOutsideMonth: boolean;
  hasDot: boolean;
  isDropTarget: boolean;
  onPress: (date: string) => void;
}) {
  const colors = useColors();

  const circleStyle = isSelected
    ? { backgroundColor: colors.primary }
    : isDropTarget
      ? {
          backgroundColor: colors.primaryLight,
          borderWidth: 1,
          borderColor: colors.primary,
        }
      : isToday
        ? { borderWidth: 2, borderColor: colors.primary }
        : undefined;

  const textColor = isSelected
    ? colors.white
    : isOutsideMonth
      ? colors.textLight
      : isDropTarget
      ? colors.primaryDark
      : colors.text;
  const dotColor = isSelected ? colors.white : colors.primary;

  return (
    <Pressable
      onPress={() => onPress(dateStr)}
      style={[dayCellStyles.cell, isOutsideMonth && dayCellStyles.disabledCell]}
    >
      <View style={[dayCellStyles.circle, circleStyle]}>
        <Text style={[dayCellStyles.text, { color: textColor }]}>{day}</Text>
      </View>
      {hasDot ? (
        <View
          style={[
            dayCellStyles.dot,
            { backgroundColor: dotColor, opacity: isOutsideMonth ? 0.35 : 1 },
          ]}
        />
      ) : null}
    </Pressable>
  );
});

const dayCellStyles = StyleSheet.create({
  cell: {
    width: `${100 / 7}%`,
    height: ROW_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  disabledCell: {
    opacity: 0.45,
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
    position: 'absolute',
    left: '50%',
    bottom: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginLeft: -DOT_SIZE / 2,
  },
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      overflow: 'hidden',
      paddingTop: CALENDAR_TOP_PADDING,
      paddingBottom: CALENDAR_BOTTOM_PADDING,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekdayRow: {
      flexDirection: 'row',
      height: WEEKDAY_ROW_HEIGHT,
      alignItems: 'center',
    },
    weekdayLabel: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    bodyClip: {
      flex: 1,
      overflow: 'hidden',
    },
    weekRow: {
      flexDirection: 'row',
    },
  });
