import {
  getMonthGridDates,
  getMonthSelectionTarget,
  getNextMonth,
  getPreviousMonth,
} from './dateUtils';

export interface TaskCalendarCell {
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
}

export interface TaskCalendarFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TaskCalendarMetrics {
  topPadding: number;
  bottomPadding: number;
  weekdayRowHeight: number;
  rowHeight: number;
}

export interface TaskCalendarNavigationTarget {
  year: number;
  month: number;
  dateStr: string;
}

function getDateParts(dateStr: string): { year: number; month: number; day: number } {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

export function buildTaskCalendarCell(
  dateStr: string,
  displayYear: number,
  displayMonth: number
): TaskCalendarCell {
  const parts = getDateParts(dateStr);

  return {
    dateStr,
    day: parts.day,
    isCurrentMonth: parts.year === displayYear && parts.month === displayMonth,
  };
}

export function buildTaskCalendarMonthWeeks(
  displayYear: number,
  displayMonth: number
): TaskCalendarCell[][] {
  return getMonthGridDates(displayYear, displayMonth).map((week) =>
    week.map((dateStr) => buildTaskCalendarCell(dateStr, displayYear, displayMonth))
  );
}

export function getTaskCalendarHeights(
  rowCount: number,
  metrics: TaskCalendarMetrics
): {
  expandedHeight: number;
  collapsedHeight: number;
} {
  const baseHeight =
    metrics.topPadding + metrics.bottomPadding + metrics.weekdayRowHeight;

  return {
    expandedHeight: baseHeight + rowCount * metrics.rowHeight,
    collapsedHeight: baseHeight + metrics.rowHeight,
  };
}

export function getTaskCalendarDateAtPosition(args: {
  frame: TaskCalendarFrame | null;
  screenX: number;
  screenY: number;
  isExpanded: boolean;
  weekDates: string[];
  expandedWeeks: TaskCalendarCell[][];
  metrics: TaskCalendarMetrics;
}): string | null {
  const { expandedWeeks, frame, isExpanded, metrics, screenX, screenY, weekDates } = args;

  if (!frame) return null;

  const localX = screenX - frame.x;
  const localY = screenY - frame.y;
  if (localX < 0 || localX > frame.width || localY < 0 || localY > frame.height) {
    return null;
  }

  const columnWidth = frame.width / 7;
  const column = Math.floor(localX / columnWidth);
  if (column < 0 || column > 6) return null;

  const bodyStartY = metrics.topPadding + metrics.weekdayRowHeight;

  if (!isExpanded) {
    if (localY < bodyStartY || localY > bodyStartY + metrics.rowHeight) {
      return null;
    }

    return weekDates[column] ?? null;
  }

  const gridLocalY = localY - bodyStartY;
  if (gridLocalY < 0) return null;

  const row = Math.floor(gridLocalY / metrics.rowHeight);
  return expandedWeeks[row]?.[column]?.dateStr ?? null;
}

export function getTaskCalendarNavigationTarget(
  displayYear: number,
  displayMonth: number,
  direction: 'previous' | 'next',
  todayStr: string
): TaskCalendarNavigationTarget {
  const targetMonth =
    direction === 'next'
      ? getNextMonth(displayYear, displayMonth)
      : getPreviousMonth(displayYear, displayMonth);

  return {
    year: targetMonth.year,
    month: targetMonth.month,
    dateStr: getMonthSelectionTarget(targetMonth.year, targetMonth.month, todayStr),
  };
}
