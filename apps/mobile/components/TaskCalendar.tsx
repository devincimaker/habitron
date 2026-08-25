/* eslint-disable max-lines -- HAB-89: split pending */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getTodayDate } from '@habits-coach/shared';
import { FONT_SIZES, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import {
  getWeekDaysStartingSunday,
  toDateString,
  type DayInfo,
} from '../utils/dateUtils';
import {
  buildTaskCalendarMonthWeeks,
  getTaskCalendarDateAtPosition,
  getTaskCalendarHeights,
  getTaskCalendarNavigationTarget,
  type TaskCalendarCell,
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
const HORIZONTAL_SWIPE_ACTIVATION_DISTANCE = 8;
const VERTICAL_DRAG_ACTIVATION_DISTANCE = 6;
const HORIZONTAL_SWIPE_THRESHOLD_RATIO = 0.22;
const HORIZONTAL_SWIPE_THRESHOLD_MIN = 72;
const EXPAND_DRAG_DISTANCE_MIN = 160;
const EXPAND_COMMIT_PROGRESS = 0.5;
const EXPAND_VELOCITY_THRESHOLD = 420;
const DOT_SIZE = 5;
const DOT_BOTTOM_OFFSET = 4;
const CALENDAR_SWIPE_MIDPOINT_MIN_OPACITY = 0.42;
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

function shiftDateString(dateStr: string, dayOffset: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + dayOffset);
  return toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(value, max));
}

function getExpandProgress(
  startProgress: number,
  translationY: number,
  dragDistance: number
): number {
  'worklet';
  return clamp(startProgress + translationY / dragDistance, 0, 1);
}

function getSwipeDirection(
  translationX: number,
  threshold: number
): 'previous' | 'next' | null {
  'worklet';
  if (translationX > threshold) return 'previous';
  if (translationX < -threshold) return 'next';
  return null;
}

const calendarMetrics: TaskCalendarMetrics = {
  topPadding: CALENDAR_TOP_PADDING,
  bottomPadding: CALENDAR_BOTTOM_PADDING,
  weekdayRowHeight: WEEKDAY_ROW_HEIGHT,
  rowHeight: ROW_HEIGHT,
};

function CalendarPageStrip({
  containerStyle,
  pageStyle,
  previous,
  current,
  next,
  previousAnimatedStyle,
  currentAnimatedStyle,
  nextAnimatedStyle,
}: {
  containerStyle: StyleProp<ViewStyle>;
  pageStyle: StyleProp<ViewStyle>;
  previous: ReactNode;
  current: ReactNode;
  next: ReactNode;
  previousAnimatedStyle: StyleProp<ViewStyle>;
  currentAnimatedStyle: StyleProp<ViewStyle>;
  nextAnimatedStyle: StyleProp<ViewStyle>;
}) {
  return (
    <View style={containerStyle}>
      <Animated.View pointerEvents="none" style={[pageStyle, previousAnimatedStyle]}>
        {previous}
      </Animated.View>
      <Animated.View style={[pageStyle, currentAnimatedStyle]}>{current}</Animated.View>
      <Animated.View pointerEvents="none" style={[pageStyle, nextAnimatedStyle]}>
        {next}
      </Animated.View>
    </View>
  );
}

export const TaskCalendar = forwardRef<TaskCalendarRef, TaskCalendarProps>(
  function TaskCalendar(
    { selectedDate, onSelectDate, taskDatesWithDots, dragHoverDate },
    ref
  ) {
    const [styles] = useThemedStyles(createStyles);
    const containerRef = useRef<View>(null);
    const { width: windowWidth } = useWindowDimensions();
    const todayStr = getTodayDate();

    const [isExpanded, setIsExpanded] = useState(false);
    const [renderExpandedBody, setRenderExpandedBody] = useState(false);
    const [displayYear, setDisplayYear] = useState(() => getDateParts(selectedDate).year);
    const [displayMonth, setDisplayMonth] = useState(() => getDateParts(selectedDate).month);
    const [frame, setFrame] = useState<TaskCalendarFrame | null>(null);
    const expandProgress = useSharedValue(0);
    const expandGestureStartProgress = useSharedValue(0);
    const pageTranslateX = useSharedValue(0);

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
    const pageWidth = frame?.width ?? windowWidth;
    const horizontalSwipeThreshold = Math.max(
      windowWidth * HORIZONTAL_SWIPE_THRESHOLD_RATIO,
      HORIZONTAL_SWIPE_THRESHOLD_MIN
    );
    const expandDragDistance = Math.max(
      expandedHeight - collapsedHeight,
      EXPAND_DRAG_DISTANCE_MIN
    );
    const syncDisplayedMonth = useCallback((dateStr: string) => {
      const parts = getDateParts(dateStr);
      setDisplayYear(parts.year);
      setDisplayMonth(parts.month);
    }, []);

    const measureFrame = useCallback(() => {
      if (!containerRef.current) return;

      containerRef.current.measureInWindow((x, y, width, height) => {
        setFrame({ x, y, width, height });
      });
    }, []);

    useEffect(() => {
      if (isExpanded) return;
      syncDisplayedMonth(selectedDate);
    }, [isExpanded, selectedDate, syncDisplayedMonth]);

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

    const prepareExpandedBody = useCallback(() => {
      syncDisplayedMonth(selectedDate);
      setRenderExpandedBody(true);
    }, [selectedDate, syncDisplayedMonth]);

    const handleExpand = useCallback(() => {
      prepareExpandedBody();
      setIsExpanded(true);
      pageTranslateX.value = 0;
      expandProgress.value = withTiming(1, TIMING_CONFIG);
    }, [expandProgress, pageTranslateX, prepareExpandedBody]);

    const handleCollapse = useCallback(() => {
      setIsExpanded(false);
      pageTranslateX.value = 0;
      expandProgress.value = withTiming(0, TIMING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(setRenderExpandedBody)(false);
        }
      });
    }, [expandProgress, pageTranslateX]);

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

    const adjacentExpandedWeeks = useMemo(() => {
      const buildAdjacentWeeks = (direction: 'previous' | 'next') => {
        const target = getTaskCalendarNavigationTarget(
          displayYear,
          displayMonth,
          direction,
          todayStr
        );
        return buildTaskCalendarMonthWeeks(target.year, target.month);
      };

      return {
        previous: buildAdjacentWeeks('previous'),
        next: buildAdjacentWeeks('next'),
      };
    }, [displayMonth, displayYear, todayStr]);

    const adjacentWeekDays = useMemo(
      () => ({
        previous: getWeekDaysStartingSunday(shiftDateString(selectedDate, -7)),
        next: getWeekDaysStartingSunday(shiftDateString(selectedDate, 7)),
      }),
      [selectedDate]
    );

    const finishMonthNavigation = useCallback(
      (direction: 'previous' | 'next') => {
        handleMonthNavigation(direction);
        requestAnimationFrame(() => {
          pageTranslateX.value = 0;
        });
      },
      [handleMonthNavigation, pageTranslateX]
    );

    const finishWeekNavigation = useCallback(
      (direction: 1 | -1) => {
        handleWeekShift(direction);
        requestAnimationFrame(() => {
          pageTranslateX.value = 0;
        });
      },
      [handleWeekShift, pageTranslateX]
    );

    const handleSelectDate = useCallback(
      (dateStr: string) => {
        onSelectDate(dateStr);

        if (!renderExpandedBody) return;

        const parts = getDateParts(dateStr);
        if (parts.year !== displayYear || parts.month !== displayMonth) {
          syncDisplayedMonth(dateStr);
        }
      },
      [displayMonth, displayYear, onSelectDate, renderExpandedBody, syncDisplayedMonth]
    );

    const horizontalPan = Gesture.Pan()
      .activeOffsetX([
        -HORIZONTAL_SWIPE_ACTIVATION_DISTANCE,
        HORIZONTAL_SWIPE_ACTIVATION_DISTANCE,
      ])
      .failOffsetY([-18, 18])
      .onStart(() => {
        cancelAnimation(pageTranslateX);
      })
      .onUpdate((event) => {
        pageTranslateX.value = clamp(event.translationX, -pageWidth, pageWidth);
      })
      .onEnd((event) => {
        const swipeDirection = getSwipeDirection(
          event.translationX,
          horizontalSwipeThreshold
        );

        if (!swipeDirection) {
          pageTranslateX.value = withTiming(0, TIMING_CONFIG);
          return;
        }

        const targetX = swipeDirection === 'previous' ? pageWidth : -pageWidth;
        pageTranslateX.value = withTiming(targetX, TIMING_CONFIG, (finished) => {
          if (!finished) return;

          if (isExpanded) {
            runOnJS(finishMonthNavigation)(swipeDirection);
          } else {
            runOnJS(finishWeekNavigation)(swipeDirection === 'previous' ? -1 : 1);
          }
        });
      });

    const verticalPan = Gesture.Pan()
      .activeOffsetY([
        -VERTICAL_DRAG_ACTIVATION_DISTANCE,
        VERTICAL_DRAG_ACTIVATION_DISTANCE,
      ])
      .failOffsetX([-18, 18])
      .onStart(() => {
        cancelAnimation(expandProgress);
        expandGestureStartProgress.value = expandProgress.value;

        if (!renderExpandedBody) {
          runOnJS(prepareExpandedBody)();
        }
      })
      .onUpdate((event) => {
        expandProgress.value = getExpandProgress(
          expandGestureStartProgress.value,
          event.translationY,
          expandDragDistance
        );
      })
      .onEnd((event) => {
        const nextProgress = getExpandProgress(
          expandGestureStartProgress.value,
          event.translationY,
          expandDragDistance
        );
        const startedExpanded = expandGestureStartProgress.value >= EXPAND_COMMIT_PROGRESS;

        const shouldEndExpanded = startedExpanded
          ? !(
              nextProgress < EXPAND_COMMIT_PROGRESS ||
              event.velocityY < -EXPAND_VELOCITY_THRESHOLD
            )
          : nextProgress > EXPAND_COMMIT_PROGRESS ||
            event.velocityY > EXPAND_VELOCITY_THRESHOLD;

        if (shouldEndExpanded) {
          runOnJS(handleExpand)();
        } else {
          runOnJS(handleCollapse)();
        }
      });

    const calendarGesture = Gesture.Race(verticalPan, horizontalPan);

    const containerAnimatedStyle = useAnimatedStyle(() => ({
      height: interpolate(expandProgress.value, [0, 1], [collapsedHeight, expandedHeight]),
    }));

    const pageOpacity = useDerivedValue(() => {
      const progress = clamp(Math.abs(pageTranslateX.value) / pageWidth, 0, 1);
      return interpolate(
        progress,
        [0, 0.5, 1],
        [1, CALENDAR_SWIPE_MIDPOINT_MIN_OPACITY, 1]
      );
    }, [pageWidth]);

    const currentMonthAnimatedStyle = useAnimatedStyle(() => {
      return {
        opacity: pageOpacity.value,
        transform: [{ translateX: pageTranslateX.value }],
      };
    });

    const previousMonthAnimatedStyle = useAnimatedStyle(() => ({
      opacity: pageOpacity.value,
      transform: [{ translateX: pageTranslateX.value - pageWidth }],
    }));

    const nextMonthAnimatedStyle = useAnimatedStyle(() => ({
      opacity: pageOpacity.value,
      transform: [{ translateX: pageTranslateX.value + pageWidth }],
    }));

    const collapsedBodyAnimatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(expandProgress.value, [0, 0.28, 1], [1, 0.12, 0]),
      transform: [
        {
          translateY: interpolate(expandProgress.value, [0, 1], [0, -8]),
        },
      ],
    }));

    const expandedBodyAnimatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(expandProgress.value, [0, 0.2, 1], [0, 0.12, 1]),
      transform: [
        {
          translateY: interpolate(expandProgress.value, [0, 1], [14, 0]),
        },
      ],
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

    const renderMonthWeeks = useCallback(
      (weeks: TaskCalendarCell[][]) =>
        weeks.map((week, rowIndex) => (
          <View key={`expanded-week-${rowIndex}`} style={styles.weekRow}>
            {week.map((cell) => (
              <DayCell
                key={cell.dateStr}
                dateStr={cell.dateStr}
                day={cell.day}
                isSelected={cell.dateStr === selectedDate && cell.isCurrentMonth}
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
        handleSelectDate,
        selectedDate,
        styles.weekRow,
        taskDatesWithDots,
        todayStr,
      ]
    );
    const renderWeekRow = useCallback(
      (days: DayInfo[], highlightedDate: string | null) => (
        <View style={styles.weekRow}>
          {days.map((day) => (
            <DayCell
              key={day.date}
              dateStr={day.date}
              day={day.dayNumber}
              isSelected={highlightedDate === day.date}
              isToday={day.isToday}
              isOutsideMonth={false}
              hasDot={taskDatesWithDots?.has(day.date) ?? false}
              isDropTarget={dragHoverDate === day.date}
              onPress={handleSelectDate}
            />
          ))}
        </View>
      ),
      [dragHoverDate, handleSelectDate, styles.weekRow, taskDatesWithDots]
    );
    const renderedExpandedWeeks = useMemo(
      () => renderMonthWeeks(expandedWeeks),
      [expandedWeeks, renderMonthWeeks]
    );
    const renderedPreviousExpandedWeeks = useMemo(
      () => renderMonthWeeks(adjacentExpandedWeeks.previous),
      [adjacentExpandedWeeks.previous, renderMonthWeeks]
    );
    const renderedNextExpandedWeeks = useMemo(
      () => renderMonthWeeks(adjacentExpandedWeeks.next),
      [adjacentExpandedWeeks.next, renderMonthWeeks]
    );
    const renderedCurrentWeek = useMemo(
      () => renderWeekRow(weekDays, selectedDate),
      [renderWeekRow, selectedDate, weekDays]
    );
    const renderedPreviousWeek = useMemo(
      () => renderWeekRow(adjacentWeekDays.previous, null),
      [adjacentWeekDays.previous, renderWeekRow]
    );
    const renderedNextWeek = useMemo(
      () => renderWeekRow(adjacentWeekDays.next, null),
      [adjacentWeekDays.next, renderWeekRow]
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
              <Animated.View
                pointerEvents={renderExpandedBody ? 'auto' : 'none'}
                style={[styles.expandedBody, expandedBodyAnimatedStyle]}
              >
                <CalendarPageStrip
                  containerStyle={styles.monthPages}
                  pageStyle={styles.monthPage}
                  previous={<View>{renderedPreviousExpandedWeeks}</View>}
                  current={<View>{renderedExpandedWeeks}</View>}
                  next={<View>{renderedNextExpandedWeeks}</View>}
                  previousAnimatedStyle={previousMonthAnimatedStyle}
                  currentAnimatedStyle={currentMonthAnimatedStyle}
                  nextAnimatedStyle={nextMonthAnimatedStyle}
                />
              </Animated.View>
            ) : null}
            <Animated.View
              pointerEvents={renderExpandedBody ? 'none' : 'auto'}
              style={[styles.collapsedBody, collapsedBodyAnimatedStyle]}
            >
              <CalendarPageStrip
                containerStyle={styles.weekPages}
                pageStyle={styles.weekPage}
                previous={renderedPreviousWeek}
                current={renderedCurrentWeek}
                next={renderedNextWeek}
                previousAnimatedStyle={previousMonthAnimatedStyle}
                currentAnimatedStyle={currentMonthAnimatedStyle}
                nextAnimatedStyle={nextMonthAnimatedStyle}
              />
            </Animated.View>
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
    bottom: DOT_BOTTOM_OFFSET,
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
      position: 'relative',
    },
    collapsedBody: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: ROW_HEIGHT,
    },
    expandedBody: {
      ...StyleSheet.absoluteFillObject,
    },
    monthPages: {
      flex: 1,
      position: 'relative',
    },
    monthPage: {
      ...StyleSheet.absoluteFillObject,
    },
    weekRow: {
      flexDirection: 'row',
    },
    weekPages: {
      height: ROW_HEIGHT,
      position: 'relative',
    },
    weekPage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: ROW_HEIGHT,
    },
  });
