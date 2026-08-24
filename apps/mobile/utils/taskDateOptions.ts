import type { Ionicons } from '@expo/vector-icons';
import { getTodayDate } from '@habits-coach/shared';
import { getNextDay, getNextMonday } from './dateUtils';

export interface TaskDateOption {
  key: 'today' | 'tomorrow' | 'nextMonday';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  date: string;
}

/** The one-tap destinations offered wherever a task date can be set. */
export function getTaskDateOptions(): TaskDateOption[] {
  const today = getTodayDate();

  return [
    { key: 'today', label: 'Today', icon: 'today-outline', date: today },
    { key: 'tomorrow', label: 'Tomorrow', icon: 'sunny-outline', date: getNextDay(today) },
    { key: 'nextMonday', label: 'Next Monday', icon: 'calendar-outline', date: getNextMonday() },
  ];
}
