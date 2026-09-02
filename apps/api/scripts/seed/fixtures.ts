/**
 * The test account's fixture state, as plain data. Pure and dated relative to
 * the day it is built for, so a visual proof taken next month lands on the same
 * screen as one taken today.
 */
import { addDays } from '@habits-coach/habitron';
import type { Priority } from '@habits-coach/shared';

type SeedTaskStatus = 'open' | 'completed';

interface SeedTask {
  title: string;
  dueDate: string | null;
  scheduledDate: string | null;
  status: SeedTaskStatus;
  /** Set on completed tasks only; the day is what the Completed section groups by. */
  completedAt?: string;
  priority?: Priority;
  estimateMinutes?: number;
  checklist?: string[];
  /** Names a tag in `tags`; the chip on a compact row is drawn from its colour. */
  tag?: string;
  /** Names a goal in `goals` the task serves; most tasks serve none. */
  goal?: string;
}

interface SeedGoal {
  title: string;
  measure: string;
  targetDate: string;
  completedAt?: string;
  reviewedAt?: string;
}

interface SeedTag {
  name: string;
  color: string;
}

interface SeedHabit {
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

interface SeedHabitLog {
  habit: string;
  date: string;
  amount?: number;
}

interface SeedDesiredHabit {
  title: string;
  note?: string;
  /** Names a habit in `habits` that stands in for it; absent means not started. */
  habit?: string;
}

interface SeedJournalEntry {
  entryDate: string;
  content: string;
  mood: 'good' | 'neutral';
}

export interface SeedFixtures {
  goals: SeedGoal[];
  tasks: SeedTask[];
  tags: SeedTag[];
  sections: { name: string; sortOrder: number }[];
  habits: SeedHabit[];
  habitLogs: SeedHabitLog[];
  habitStartDate: string;
  desiredHabits: SeedDesiredHabit[];
  journal: SeedJournalEntry[];
  profile: { name: string };
}

/** A mid-day stamp, far enough from either midnight to stay on `date` in any timezone the author uses. */
function at(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}

/** Every habit starts the same distance back, so the histories below all fit inside it. */
const HABIT_START_DAYS_AGO = 30;

export function buildFixtures(today: string): SeedFixtures {
  const day = (offset: number) => addDays(today, offset);

  // The four hues the chip design was checked against, spread over the tasks the
  // Calendar and Tasks tabs both show, so a visual proof always has chips on screen.
  const tags: SeedTag[] = [
    { name: 'admin', color: '#FFD54F' },
    { name: 'health', color: '#AED581' },
    { name: 'work', color: '#9575CD' },
    { name: 'errands', color: '#26A69A' },
  ];

  // One open goal reviewed this week, one whose review is overdue, one done —
  // so the list, the review card and the detail screen each have a state to show.
  const goals: SeedGoal[] = [
    {
      title: 'Ship the app to the App Store',
      measure: 'Listed on the store, and a stranger can install it',
      targetDate: day(60),
      reviewedAt: at(day(-10), '18:00'),
    },
    {
      title: 'Run a half marathon',
      measure: 'Cross the finish line of a 21 km race, any time',
      targetDate: day(180),
      reviewedAt: at(day(-3), '18:00'),
    },
    {
      title: 'Pass the driving theory test',
      measure: 'The certificate in hand',
      targetDate: day(-30),
      completedAt: at(day(-12), '14:00'),
      reviewedAt: at(day(-14), '18:00'),
    },
  ];

  const tasks: SeedTask[] = [
    // Overdue: open, due in the past, and scheduled — all three are what the
    // Calendar tab's overdue partition requires.
    { title: 'Renew car insurance', dueDate: day(-2), scheduledDate: day(-2), status: 'open', priority: 1, tag: 'admin' },
    { title: 'Call the dentist', dueDate: day(-1), scheduledDate: day(-1), status: 'open', tag: 'health' },
    // Today, open
    { title: 'Write weekly review', dueDate: today, scheduledDate: today, status: 'open', estimateMinutes: 30, tag: 'work', goal: 'Ship the app to the App Store' },
    { title: 'Buy oat milk', dueDate: today, scheduledDate: today, status: 'open', checklist: ['oat milk', 'bananas'], tag: 'errands' },
    // Today, completed
    { title: 'Pay electricity bill', dueDate: today, scheduledDate: today, status: 'completed', completedAt: at(today, '09:10') },
    { title: 'Book flights', dueDate: today, scheduledDate: today, status: 'completed', completedAt: at(today, '11:40'), goal: 'Run a half marathon' },
    // Tomorrow
    { title: 'Plan next sprint', dueDate: day(1), scheduledDate: day(1), status: 'open', goal: 'Ship the app to the App Store' },
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
    goals,
    tasks,
    tags,
    sections: [
      { name: 'Morning', sortOrder: 0 },
      { name: 'Afternoon', sortOrder: 1 },
      { name: 'Night', sortOrder: 2 },
      { name: 'Others', sortOrder: 3 },
    ],
    habits,
    habitLogs,
    habitStartDate: day(-HABIT_START_DAYS_AGO),
    // One of each state, so the section has both a started and a not-started
    // row to photograph.
    desiredHabits: [
      {
        title: 'Strength training twice a week',
        note: 'The physio asked for this. Running is the smaller version I actually started.',
        habit: 'Run',
      },
      {
        title: 'Read before bed instead of the phone',
        note: 'Not while the evenings are this full.',
      },
    ],
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
