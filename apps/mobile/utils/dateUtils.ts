import { getTodayDate } from '@habits-coach/shared';

export interface DayInfo {
  date: string;
  dayNumber: number;
  weekdayLetter: string;
  isToday: boolean;
}

export function getLast7Days(): DayInfo[] {
  const days: DayInfo[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    days.push({
      date: d.toISOString().split('T')[0],
      dayNumber: d.getDate(),
      weekdayLetter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      isToday: i === 0,
    });
  }

  return days;
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
  return date.toISOString().split('T')[0];
}

export function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

export function formatDateString(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
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

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    year,
    month,
    firstDayOfWeek: firstDay.getDay(),
    daysInMonth: lastDay.getDate(),
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
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
