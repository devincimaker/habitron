import type { DailyPlanItemOutcome, HabitStatus } from '@habits-coach/shared';
import type { Db, Habit, Task } from './db.js';
import { addDays, localNow, weekRange, weekdayOf } from './time.js';

export type DayContext = Awaited<ReturnType<typeof buildDayContext>>;

export interface HabitForDay extends Habit {
  dueOnDate: boolean;
  statusOnDate: HabitStatus;
  /** Progress on the date for quantity habits. */
  amountOnDate?: number;
  completedThisWeek: number;
  completedLast14Days: number;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function isHabitDue(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'interval') {
    const every = habit.intervalDays ?? 1;
    return daysBetween(habit.startDate, date) % every === 0;
  }
  if (habit.weeklyDays && habit.weeklyDays.length > 0) {
    return habit.weeklyDays.includes(weekdayOf(date));
  }
  // Weekly-count habits are flexible: surface them every day with week progress.
  return true;
}

function sortByPriorityThenTime(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const time = (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99');
    if (time !== 0) return time;
    return (a.priority ?? 5) - (b.priority ?? 5);
  });
}

/** Compact planning packet: everything a planner needs for one day, nothing more. */
export async function buildDayContext(db: Db, timezone: string, date: string) {
  const now = localNow(timezone);
  const week = weekRange(date);
  const lookbackStart = addDays(date, -14);

  const [tasks, habits, logs, plan, journal, memories, recentPlans] = await Promise.all([
    db.listAllTasks(),
    db.listHabits(),
    db.listHabitLogs(lookbackStart < week.start ? lookbackStart : week.start, week.end),
    db.getActivePlan(date),
    db.listRecentJournalEntries(5),
    db.listMemories(),
    db.listPlans(lookbackStart, addDays(date, -1)),
  ]);

  const open = tasks.filter((t) => t.status === 'open');
  const planOutcomeByTodo = new Map(
    (plan?.items ?? []).filter((i) => i.todoId).map((i) => [i.todoId as string, i])
  );

  const scheduled = sortByPriorityThenTime(open.filter((t) => t.scheduledDate === date)).map((t) => {
    const item = planOutcomeByTodo.get(t.id);
    return item ? { ...t, planItemId: item.id, planOutcome: item.outcome } : t;
  });
  const completedOnDate = tasks.filter(
    (t) => t.status === 'completed' && t.completedAt?.slice(0, 10) === date
  );
  const overdue = open.filter((t) => t.dueDate && t.dueDate < date && t.scheduledDate !== date);
  const dueSoon = open.filter(
    (t) => t.dueDate && t.dueDate >= date && t.dueDate <= addDays(date, 7) && t.scheduledDate !== date
  );
  const scheduledLater = open.filter((t) => t.scheduledDate && t.scheduledDate > date);
  const scheduledPast = open.filter((t) => t.scheduledDate && t.scheduledDate < date);
  const unscheduled = open
    .filter((t) => !t.scheduledDate)
    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));

  const habitsForDay: HabitForDay[] = habits.map((habit) => {
    const own = logs.filter((l) => l.habitId === habit.id);
    const onDate = own.find((l) => l.date === date);
    return {
      ...habit,
      dueOnDate: isHabitDue(habit, date),
      statusOnDate: onDate?.status ?? 'pending',
      amountOnDate: habit.goalType === 'quantity' ? (onDate?.amount ?? 0) : undefined,
      completedThisWeek: own.filter(
        (l) => l.status === 'completed' && l.date >= week.start && l.date <= week.end
      ).length,
      completedLast14Days: own.filter(
        (l) => l.status === 'completed' && l.date >= lookbackStart && l.date < date
      ).length,
    };
  });

  // Behaviour signal: how the last two weeks of plans actually went.
  const finalPlans = new Map<string, (typeof recentPlans)[number]>();
  for (const p of recentPlans) {
    if (p.status === 'accepted' && !finalPlans.has(p.planDate)) finalPlans.set(p.planDate, p);
  }
  const outcomeTally: Partial<Record<DailyPlanItemOutcome, number>> = {};
  let plannedItems = 0;
  for (const p of finalPlans.values()) {
    for (const item of p.items) {
      plannedItems += 1;
      outcomeTally[item.outcome] = (outcomeTally[item.outcome] ?? 0) + 1;
    }
  }
  const versionsPerDay = new Map<string, number>();
  for (const p of recentPlans) {
    versionsPerDay.set(p.planDate, Math.max(versionsPerDay.get(p.planDate) ?? 0, p.version));
  }

  return {
    date,
    weekday: weekdayOf(date),
    now: { date: now.date, time: now.time, isSelectedDate: now.date === date },
    activePlan: plan,
    tasks: {
      scheduledForDate: scheduled,
      completedOnDate,
      overdue,
      dueWithin7Days: dueSoon,
      scheduledOnPastDates: scheduledPast,
      scheduledLater,
      unscheduled: unscheduled.slice(0, 40),
      counts: {
        open: open.length,
        scheduledForDate: scheduled.length,
        overdue: overdue.length,
        unscheduled: unscheduled.length,
        unscheduledOmitted: Math.max(0, unscheduled.length - 40),
      },
      scheduledEstimateMinutes: scheduled.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0),
    },
    habits: habitsForDay,
    recentJournal: journal,
    memories,
    recentPlanning: {
      daysWithPlansLast14: finalPlans.size,
      plannedItems,
      outcomes: outcomeTally,
      replanVersionsPerDay: Object.fromEntries(versionsPerDay),
    },
  };
}
