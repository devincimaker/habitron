import { getTodayDate } from '@habits-coach/shared';

export interface DayInfo {
  date: string;
  dayNumber: number;
  weekdayLetter: string;
  isToday: boolean;
}

export interface UpcomingDayOption {
  date: string;
  label: string;
  secondaryLabel: string;
}

export function getLast7Days(): DayInfo[] {
  const days: DayInfo[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    days.push({
      date: toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      dayNumber: d.getDate(),
      weekdayLetter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      isToday: i === 0,
    });
  }

  return days;
}

export function getUpcomingDays(count = 7): UpcomingDayOption[] {
  const days: UpcomingDayOption[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const dateString = toDateString(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate()
    );

    days.push({
      date: dateString,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long' }),
      secondaryLabel: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    });
  }

  return days;
}

/** The Monday that follows today; a week out when today is already Monday. */
export function getNextMonday(): string {
  const date = new Date(getTodayDate() + 'T00:00:00');
  date.setDate(date.getDate() + (((8 - date.getDay()) % 7) || 7));
  return toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function canGoToPreviousDay(selectedDate: string): boolean {
  const selected = new Date(selectedDate + 'T00:00:00');
  const sixDaysAgo = new Date();
  sixDaysAgo.setHours(0, 0, 0, 0);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  return selected > sixDaysAgo;
}

export function canGoToNextDay(selectedDate: string): boolean {
  const today = getTodayDate();
  return selectedDate < today;
}

export function getPreviousDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() - 1);
  return toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function formatDateString(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDateLabel(dateStr: string): string {
  const today = getTodayDate();
  if (dateStr === today) {
    return 'Today';
  }

  const tomorrow = getNextDay(today);
  if (dateStr === tomorrow) {
    return 'Tomorrow';
  }

  return formatShortDate(dateStr);
}

export function getTaskDateBadge(dateStr: string): {
  label: string;
  tone: 'upcoming' | 'overdue';
} {
  const today = getTodayDate();

  return {
    label: formatRelativeDateLabel(dateStr),
    tone: dateStr < today ? 'overdue' : 'upcoming',
  };
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Task calendar utilities

export function getWeekDaysStartingSunday(dateStr: string): DayInfo[] {
  const selectedDate = new Date(dateStr + 'T00:00:00');
  const weekStart = new Date(selectedDate);
  const days: DayInfo[] = [];
  const todayStr = getTodayDate();

  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
    days.push({
      date: ds,
      dayNumber: d.getDate(),
      weekdayLetter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      isToday: ds === todayStr,
    });
  }

  return days;
}

export function getWeekRowIndex(year: number, month: number, day: number): number {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  return Math.floor((firstDayOfWeek + day - 1) / 7);
}

export function getMonthGridDates(
  year: number,
  month: number,
  numberOfWeeks = 6
): string[][] {
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: numberOfWeeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);
      return toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
    })
  );
}

export function getFirstDateOfMonth(year: number, month: number): string {
  return toDateString(year, month + 1, 1);
}

export function getMonthSelectionTarget(
  year: number,
  month: number,
  todayDate: string
): string {
  const today = new Date(todayDate + 'T00:00:00');
  if (today.getFullYear() === year && today.getMonth() === month) {
    return todayDate;
  }

  return getFirstDateOfMonth(year, month);
}

// Month calendar utilities

export interface MonthInfo {
  year: number;
  month: number; // 0-11
  firstDayOfWeek: number; // 0=Sunday
  daysInMonth: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export function getMonthInfo(year: number, month: number): MonthInfo {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    year,
    month,
    firstDayOfWeek: firstDay.getDay(),
    daysInMonth: lastDay.getDate(),
    startDate: toDateString(year, month + 1, 1),
    endDate: toDateString(year, month + 1, lastDay.getDate()),
  };
}

export function getMonthDisplayString(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getPreviousMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
}

export function getNextMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 11) {
    return { year: year + 1, month: 0 };
  }
  return { year, month: month + 1 };
}

export function isMonthAfterOrEqual(
  yearA: number,
  monthA: number,
  yearB: number,
  monthB: number
): boolean {
  return yearA > yearB || (yearA === yearB && monthA >= monthB);
}

export function getDateFromTimestamp(timestamp: number): {
  year: number;
  month: number;
  day: number;
} {
  const date = new Date(timestamp);
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}
