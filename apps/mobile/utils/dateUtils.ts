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
