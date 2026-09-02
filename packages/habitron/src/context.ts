import type { DailyPlanItemOutcome, HabitStatus, Module } from '@habits-coach/shared';
import { buildScorecard } from './scorecard.js';
import type { Db, DesiredHabitRecord, Habit, Task } from './db.js';
import { goalsForDay } from './goals.js';
import { addDays, localDateOf, localNow, weekRange, weekdayOf } from './time.js';

export type DayContext = Awaited<ReturnType<typeof buildDayContext>>;

export interface HabitForDay extends Habit {
  dueOnDate: boolean;
  statusOnDate: HabitStatus;
  /** Progress on the date for quantity habits. */
  amountOnDate?: number;
  completedThisWeek: number;
  completedLast14Days: number;
}

/** The stand-in habit, cut down to what a planning decision actually needs. */
type StandInHabit = Pick<
  HabitForDay,
  'id' | 'name' | 'active' | 'frequency' | 'startDate' | 'completedLast14Days'
>;

/** A desired habit with whatever is standing in for it already resolved. */
export interface DesiredHabitForDay {
  id: string;
  title: string;
  note?: string;
  workingOnIt: StandInHabit | null;
}

/**
 * Resolves each desired habit's stand-in against **every** habit, archived ones
 * included: an abandoned attempt is signal about what was tried, not noise. A
 * `habitId` with no matching habit reads the same as none — the row's habit was
 * deleted and the FK nulled it, or the list is momentarily ahead of the habits.
 */
export function resolveDesiredHabits(
  desired: DesiredHabitRecord[],
  habits: HabitForDay[]
): DesiredHabitForDay[] {
  const byId = new Map(habits.map((habit) => [habit.id, habit]));
  return desired.map((row) => {
    const habit = row.habitId ? byId.get(row.habitId) : undefined;
    return {
      id: row.id,
      title: row.title,
      note: row.note,
      workingOnIt: habit
        ? {
            id: habit.id,
            name: habit.name,
            active: habit.active,
            frequency: habit.frequency,
            startDate: habit.startDate,
            completedLast14Days: habit.completedLast14Days,
          }
        : null,
    };
  });
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

/** Tasks with a checklist get a compact done/total counter for the packet. */
function withChecklistProgress<T extends Task>(task: T) {
  if (!task.checklist) return task;
  return {
    ...task,
    checklistProgress: {
      done: task.checklist.filter((item) => item.done).length,
      total: task.checklist.length,
    },
  };
}

function sortByPriorityThenTime(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const time = (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99');
    if (time !== 0) return time;
    return (a.priority ?? 5) - (b.priority ?? 5);
  });
}

/**
 * Compact planning packet: everything a planner needs for one day, nothing
 * more. `disabledModules` is what Profile has switched off: such a module is
 * not read at all, so it is out of the coach's context and not merely empty.
 */
export async function buildDayContext(
  db: Db,
  timezone: string,
  date: string,
  disabledModules: readonly Module[]
) {
  const now = localNow(timezone);
  const week = weekRange(date);
  const lookbackStart = addDays(date, -14);

  const [tasks, allHabits, logs, plan, journal, memories, recentPlans, desired, review, goals] =
    await Promise.all([
      db.listAllTasks(),
      // Archived habits included, so a desired habit's abandoned attempt still
      // resolves; the `habits` field below filters back down to the active ones.
      db.listHabits(true),
      db.listHabitLogs(lookbackStart < week.start ? lookbackStart : week.start, week.end),
      db.getActivePlan(date),
      db.listRecentJournalEntries(5),
      db.listMemories(),
      db.listPlans(lookbackStart, addDays(date, -1)),
      db.listDesiredHabits(),
      db.getDayReview(date),
      disabledModules.includes('goals') ? null : db.listGoals(),
    ]);

  const open = tasks.filter((t) => t.status === 'open');
  const planOutcomeByTodo = new Map(
    (plan?.items ?? []).filter((i) => i.todoId).map((i) => [i.todoId as string, i])
  );

  const scheduled = sortByPriorityThenTime(open.filter((t) => t.scheduledDate === date)).map((t) => {
    const item = planOutcomeByTodo.get(t.id);
    const task = withChecklistProgress(t);
    return item ? { ...task, planItemId: item.id, planOutcome: item.outcome } : task;
  });
  const completedOnDate = tasks
    .filter((t) => t.status === 'completed' && t.completedAt && localDateOf(t.completedAt, timezone) === date)
    .map(withChecklistProgress);
  const overdue = open
    .filter((t) => t.dueDate && t.dueDate < date && t.scheduledDate !== date)
    .map(withChecklistProgress);
  const dueSoon = open
    .filter(
      (t) => t.dueDate && t.dueDate >= date && t.dueDate <= addDays(date, 7) && t.scheduledDate !== date
    )
    .map(withChecklistProgress);
  const scheduledLater = open
    .filter((t) => t.scheduledDate && t.scheduledDate > date)
    .map(withChecklistProgress);
  const scheduledPast = open
    .filter((t) => t.scheduledDate && t.scheduledDate < date)
    .map(withChecklistProgress);
  const unscheduled = open
    .filter((t) => !t.scheduledDate)
    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
    .map(withChecklistProgress);

  const habitsForDay: HabitForDay[] = allHabits.map((habit) => {
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

  const activeHabits = habitsForDay.filter((habit) => habit.active);

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
    habits: activeHabits,
    desiredHabits: resolveDesiredHabits(desired, habitsForDay),
    // The destination the day is planned toward. Absent, not empty, when the
    // Goals module is off.
    ...(goals ? { goals: goalsForDay(goals, tasks, date) } : {}),
    // The day in numbers, so a review opens with the facts instead of asking for
    // them. Recomputed every call — nothing here is stored on `day_reviews`.
    scorecard: buildScorecard({
      planItems: plan?.items ?? null,
      habits: activeHabits,
      completedTasks: completedOnDate,
    }),
    /** Today's review if one exists, so a second visit resumes instead of restarting. */
    review,
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
