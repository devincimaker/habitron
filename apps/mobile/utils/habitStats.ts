import { HabitStatus, getTodayDate } from '@habits-coach/shared';

export interface HabitStats {
  monthlyCheckIns: number;
  totalCheckIns: number;
  monthlyRate: number; // 0-100 percentage
  currentStreak: number;
}

export function calculateMonthlyCheckIns(
  monthLogs: Map<string, HabitStatus>
): number {
  let count = 0;
  for (const status of monthLogs.values()) {
    if (status === 'completed') count++;
  }
  return count;
}

export function calculateMonthlyRate(
  monthLogs: Map<string, HabitStatus>,
  displayedYear: number,
  displayedMonth: number,
  habitCreatedAt: number
): number {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const createdDate = new Date(habitCreatedAt);
  const createdYear = createdDate.getFullYear();
  const createdMonth = createdDate.getMonth();
  const createdDay = createdDate.getDate();

  // If displayed month is before habit creation, return 0
  if (
    displayedYear < createdYear ||
    (displayedYear === createdYear && displayedMonth < createdMonth)
  ) {
    return 0;
  }

  // Determine start day for counting
  let startDay = 1;
  if (displayedYear === createdYear && displayedMonth === createdMonth) {
    startDay = createdDay;
  }

  // Determine end day for counting
  let endDay = new Date(displayedYear, displayedMonth + 1, 0).getDate();
  if (displayedYear === todayYear && displayedMonth === todayMonth) {
    endDay = todayDate;
  }
  // If displayed month is in the future, return 0
  if (
    displayedYear > todayYear ||
    (displayedYear === todayYear && displayedMonth > todayMonth)
  ) {
    return 0;
  }

  const totalDays = endDay - startDay + 1;
  if (totalDays <= 0) return 0;

  const completedDays = calculateMonthlyCheckIns(monthLogs);
  return Math.round((completedDays / totalDays) * 100);
}

export function calculateStreak(
  allLogs: Map<string, HabitStatus>,
  habitCreatedAt: number
): number {
  const today = getTodayDate();
  let streak = 0;
  const currentDate = new Date(today + 'T00:00:00');
  const createdDate = new Date(habitCreatedAt);
  createdDate.setHours(0, 0, 0, 0);

  while (currentDate >= createdDate) {
    const dateStr = formatDateString(currentDate);
    const status = allLogs.get(dateStr);

    if (status === 'completed') {
      streak++;
    } else {
      // Break streak on skip, pending, or no entry
      // But if today is not yet marked, check if we have a streak from yesterday
      if (dateStr === today && streak === 0) {
        // Today not marked, continue checking from yesterday
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }
      break;
    }

    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
