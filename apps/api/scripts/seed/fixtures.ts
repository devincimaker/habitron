/**
 * The test account's fixture state, as plain data. Pure and dated relative to
 * the day it is built for, so a visual proof taken next month lands on the same
 * screen as one taken today.
 */
import { addDays } from '@habits-coach/habitron';
import type { Priority } from '@habits-coach/shared';

export type SeedTaskStatus = 'open' | 'completed';

export interface SeedTask {
  title: string;
  dueDate: string | null;
  scheduledDate: string | null;
  status: SeedTaskStatus;
  /** Set on completed tasks only; the day is what the Completed section groups by. */
  completedAt?: string;
  priority?: Priority;
  estimateMinutes?: number;
  checklist?: string[];
}

export interface SeedHabit {
  name: string;
  frequency: 'daily' | 'weekly' | 'interval';
  goalType: 'boolean' | 'quantity';
  section: string;
  weeklyCount?: number;
  intervalDays?: number;
  targetAmount?: number;
  unit?: string;
  recordIncrement?: number;
}

export interface SeedHabitLog {
  habit: string;
  date: string;
  amount?: number;
}

export interface SeedJournalEntry {
  entryDate: string;
  content: string;
  mood: 'good' | 'neutral';
}

export interface SeedFixtures {
  tasks: SeedTask[];
  sections: { name: string; sortOrder: number }[];
  habits: SeedHabit[];
  habitLogs: SeedHabitLog[];
  habitStartDate: string;
  journal: SeedJournalEntry[];
  profile: { name: string };
}

/** A mid-day stamp, far enough from either midnight to stay on `date` in any timezone the author uses. */
function at(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}

/** Every habit starts the same distance back, so the histories below all fit inside it. */
export const HABIT_START_DAYS_AGO = 30;

export function buildFixtures(today: string): SeedFixtures {
  const day = (offset: number) => addDays(today, offset);

  const tasks: SeedTask[] = [
    // Overdue: open, due in the past, and scheduled — all three are what the
    // Calendar tab's overdue partition requires.
    { title: 'Renew car insurance', dueDate: day(-2), scheduledDate: day(-2), status: 'open', priority: 1 },
    { title: 'Call the dentist', dueDate: day(-1), scheduledDate: day(-1), status: 'open' },
    // Today, open
    { title: 'Write weekly review', dueDate: today, scheduledDate: today, status: 'open', estimateMinutes: 30 },
    { title: 'Buy oat milk', dueDate: today, scheduledDate: today, status: 'open', checklist: ['oat milk', 'bananas'] },
    // Today, completed
    { title: 'Pay electricity bill', dueDate: today, scheduledDate: today, status: 'completed', completedAt: at(today, '09:10') },
    { title: 'Book flights', dueDate: today, scheduledDate: today, status: 'completed', completedAt: at(today, '11:40') },
    // Tomorrow
    { title: 'Plan next sprint', dueDate: day(1), scheduledDate: day(1), status: 'open' },
    // Undated: only the Tasks tab shows these
    { title: 'Groceries', dueDate: null, scheduledDate: null, status: 'open' },
    { title: 'Read 20 pages', dueDate: null, scheduledDate: null, status: 'completed', completedAt: at(day(-3), '20:00') },
    { title: 'Cancel old subscription', dueDate: null, scheduledDate: null, status: 'completed', completedAt: at(day(-1), '16:30') },
  ];

  const habits: SeedHabit[] = [
    { name: 'Meditate', frequency: 'daily', goalType: 'boolean', section: 'Morning' },
    {
      name: 'Drink water',
      frequency: 'daily',
      goalType: 'quantity',
      section: 'Others',
      targetAmount: 8,
      unit: 'glasses',
      recordIncrement: 1,
    },
    { name: 'Run', frequency: 'weekly', goalType: 'boolean', section: 'Afternoon', weeklyCount: 3 },
    { name: 'Stretch', frequency: 'interval', goalType: 'boolean', section: 'Night', intervalDays: 2 },
  ];

  const habitLogs: SeedHabitLog[] = [
    // A seven-day streak on Meditate, with today deliberately still pending.
    ...[7, 6, 5, 4, 3, 2, 1].map((back) => ({ habit: 'Meditate', date: day(-back) })),
    ...[3, 2, 1].map((back) => ({ habit: 'Drink water', date: day(-back), amount: 8 })),
    { habit: 'Run', date: day(-2) },
    { habit: 'Stretch', date: day(-4) },
    { habit: 'Stretch', date: day(-2) },
  ];

  return {
    tasks,
    sections: [
      { name: 'Morning', sortOrder: 0 },
      { name: 'Afternoon', sortOrder: 1 },
      { name: 'Night', sortOrder: 2 },
      { name: 'Others', sortOrder: 3 },
    ],
    habits,
    habitLogs,
    habitStartDate: day(-HABIT_START_DAYS_AGO),
    journal: [
      {
        entryDate: day(-1),
        content: 'Cleared the morning block before anything else landed. The afternoon went to meetings, which was the trade I chose.',
        mood: 'good',
      },
      {
        entryDate: day(-3),
        content: 'Slow start and I never quite caught up. Nothing went wrong; the day just did not have a shape.',
        mood: 'neutral',
      },
    ],
    profile: { name: 'Test' },
  };
}
