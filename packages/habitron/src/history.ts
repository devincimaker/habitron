import type { HabitStatus, HabitWeekday } from '@habits-coach/shared';
import type { Db, Habit, HabitLogRecord } from './db.js';
import { addDays, localNow, weekdayOf } from './time.js';

const WEEKDAYS: HabitWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/** Is the habit expected on this date? Weekly-count habits have no fixed days, so only daily/pinned/interval habits return true. */
export function isHabitScheduled(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'interval') {
    return daysBetween(habit.startDate, date) % (habit.intervalDays ?? 1) === 0;
  }
  return Boolean(habit.weeklyDays?.includes(weekdayOf(date)));
}

interface StreakResult {
  current: number;
  longest: number;
  lastCompleted?: string;
}

/**
 * Streaks count consecutive *scheduled* occurrences completed. For flexible
 * weekly-count habits every day counts, so streaks are consecutive completed days.
 */
function computeStreaks(habit: Habit, logsByDate: Map<string, HabitLogRecord>, start: string, end: string): StreakResult {
  const flexible = habit.frequency === 'weekly' && !habit.weeklyDays?.length;
  let longest = 0;
  let run = 0;
  let lastCompleted: string | undefined;

  for (const date of eachDay(start, end)) {
    const scheduled = flexible ? true : isHabitScheduled(habit, date);
    if (!scheduled) continue;
    const log = logsByDate.get(date);
    if (log?.status === 'completed') {
      run += 1;
      longest = Math.max(longest, run);
      lastCompleted = date;
    } else if (flexible) {
      // a missed day on a flexible habit breaks the day-run but is not a "miss"
      run = 0;
    } else if (date < end) {
      run = 0;
    }
    // On the last day (today) a pending scheduled habit doesn't break the streak yet.
  }
  return { current: run, longest, lastCompleted };
}

export async function buildHabitHistory(db: Db, timezone: string, args: { days: number; habitId?: string }) {
  const end = localNow(timezone).date;
  const start = addDays(end, -(args.days - 1));
  const [habits, logs] = await Promise.all([db.listHabits(true), db.listHabitLogs(start, end)]);
  const selected = args.habitId ? habits.filter((h) => h.id === args.habitId) : habits.filter((h) => h.active);
  if (args.habitId && selected.length === 0) {
    throw new Error(`Habit not found: ${args.habitId}`);
  }

  const midpoint = addDays(start, Math.floor(args.days / 2));

  const report = selected.map((habit) => {
    const own = logs.filter((l) => l.habitId === habit.id);
    const byDate = new Map(own.map((l) => [l.date, l]));
    const windowStart = habit.startDate > start ? habit.startDate : start;
    const days = eachDay(windowStart, end);
    const flexible = habit.frequency === 'weekly' && !habit.weeklyDays?.length;

    const grid = days.map((date) => {
      const log = byDate.get(date);
      const entry: { date: string; weekday: HabitWeekday; scheduled: boolean; status: HabitStatus; amount?: number } = {
        date,
        weekday: weekdayOf(date),
        scheduled: flexible ? true : isHabitScheduled(habit, date),
        status: log?.status ?? 'pending',
      };
      if (habit.goalType === 'quantity') entry.amount = log?.amount ?? 0;
      return entry;
    });

    const scheduledDays = grid.filter((g) => g.scheduled);
    const completed = grid.filter((g) => g.status === 'completed');
    const skipped = grid.filter((g) => g.status === 'skipped');
    const expected = flexible
      ? Math.round((days.length / 7) * (habit.weeklyCount ?? 1))
      : scheduledDays.length;

    const byWeekday = WEEKDAYS.map((weekday) => {
      const cells = grid.filter((g) => g.weekday === weekday && g.scheduled);
      const done = cells.filter((g) => g.status === 'completed').length;
      return { weekday, scheduled: cells.length, completed: done, rate: cells.length ? round(done / cells.length) : null };
    }).filter((w) => w.scheduled > 0);

    const firstHalf = grid.filter((g) => g.scheduled && g.date < midpoint);
    const secondHalf = grid.filter((g) => g.scheduled && g.date >= midpoint);
    const rateOf = (cells: typeof grid) =>
      cells.length ? round(cells.filter((g) => g.status === 'completed').length / cells.length) : null;

    const amounts = habit.goalType === 'quantity' ? completed.map((g) => g.amount ?? 0).concat(grid.filter((g) => g.status !== 'completed' && (g.amount ?? 0) > 0).map((g) => g.amount ?? 0)) : [];

    return {
      habit,
      window: { start: windowStart, end, days: days.length },
      expectedCompletions: expected,
      completed: completed.length,
      skipped: skipped.length,
      missed: Math.max(0, expected - completed.length - (flexible ? 0 : skipped.length)),
      completionRate: expected ? round(completed.length / expected) : null,
      streaks: computeStreaks(habit, byDate, windowStart, end),
      trend: { firstHalfRate: rateOf(firstHalf), secondHalfRate: rateOf(secondHalf) },
      byWeekday,
      quantity:
        habit.goalType === 'quantity'
          ? {
              unit: habit.unit,
              target: habit.targetAmount,
              total: round(amounts.reduce((s, a) => s + a, 0)),
              averageOnLoggedDays: amounts.length ? round(amounts.reduce((s, a) => s + a, 0) / amounts.length) : null,
              daysAtOrAboveTarget: habit.targetAmount ? grid.filter((g) => (g.amount ?? 0) >= (habit.targetAmount ?? 0)).length : null,
            }
          : undefined,
      grid,
    };
  });

  return { window: { start, end, days: args.days }, habits: report };
}

function hourBucket(time?: string): 'morning' | 'afternoon' | 'evening' | 'night' | 'unscheduled' {
  if (!time) return 'unscheduled';
  const hour = Number(time.slice(0, 2));
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export async function buildTaskHistory(db: Db, timezone: string, args: { days: number }) {
  const end = localNow(timezone).date;
  const start = addDays(end, -(args.days - 1));
  const [tasks, plans] = await Promise.all([db.listAllTasks(), db.listPlans(start, end)]);

  const completed = tasks
    .filter((t) => t.status === 'completed' && t.completedAt && t.completedAt.slice(0, 10) >= start && t.completedAt.slice(0, 10) <= end)
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));
  const canceled = tasks.filter((t) => t.status === 'canceled' && t.canceledAt && t.canceledAt.slice(0, 10) >= start);
  const created = tasks.filter((t) => t.createdAt.slice(0, 10) >= start);

  const perDay = new Map<string, number>();
  for (const t of completed) {
    const d = (t.completedAt ?? '').slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const daysWithCompletions = perDay.size;

  const withEstimates = completed.filter((t) => t.estimateMinutes && t.actualMinutes);
  const estimateAccuracy = withEstimates.length
    ? {
        sampleSize: withEstimates.length,
        averageRatioActualToEstimate: round(
          withEstimates.reduce((s, t) => s + (t.actualMinutes ?? 0) / (t.estimateMinutes ?? 1), 0) / withEstimates.length
        ),
        totalEstimatedMinutes: withEstimates.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0),
        totalActualMinutes: withEstimates.reduce((s, t) => s + (t.actualMinutes ?? 0), 0),
      }
    : null;

  const byWeekday = WEEKDAYS.map((weekday) => ({
    weekday,
    completed: completed.filter((t) => weekdayOf((t.completedAt ?? '').slice(0, 10)) === weekday).length,
  }));
  const byScheduledTime: Record<string, number> = {};
  for (const t of completed) {
    const bucket = hourBucket(t.scheduledTime);
    byScheduledTime[bucket] = (byScheduledTime[bucket] ?? 0) + 1;
  }

  // Plan outcomes in the window (final version per day).
  const finalPlans = new Map<string, (typeof plans)[number]>();
  for (const p of plans) if (p.status === 'accepted' && !finalPlans.has(p.planDate)) finalPlans.set(p.planDate, p);
  const outcomes: Record<string, number> = {};
  for (const p of finalPlans.values()) for (const i of p.items) outcomes[i.outcome] = (outcomes[i.outcome] ?? 0) + 1;

  const openAgeDays = tasks
    .filter((t) => t.status === 'open')
    .map((t) => daysBetween(t.createdAt.slice(0, 10), end));

  // Completed work per category, so the coach can spot neglected areas of life.
  const byTag: Record<string, { tagId: string | null; completed: number; minutes: number }> = {};
  for (const t of completed) {
    const key = t.tag?.name ?? 'untagged';
    const entry = (byTag[key] ??= { tagId: t.tag?.id ?? null, completed: 0, minutes: 0 });
    entry.completed += 1;
    entry.minutes += t.actualMinutes ?? t.estimateMinutes ?? 0;
  }

  return {
    window: { start, end, days: args.days },
    summary: {
      completed: completed.length,
      canceled: canceled.length,
      created: created.length,
      daysWithCompletions,
      averageCompletedPerActiveDay: daysWithCompletions ? round(completed.length / daysWithCompletions) : 0,
      openTasks: openAgeDays.length,
      oldestOpenTaskAgeDays: openAgeDays.length ? Math.max(...openAgeDays) : 0,
      /** Completed count and minutes (actual, else estimate) per category; tags with no completions are absent. */
      byTag,
    },
    estimateAccuracy,
    byWeekday,
    byScheduledTime,
    planOutcomes: { daysPlanned: finalPlans.size, outcomes },
    completedTasks: completed.map((t) => ({
      id: t.id,
      title: t.title,
      completedAt: t.completedAt,
      scheduledDate: t.scheduledDate,
      scheduledTime: t.scheduledTime,
      estimateMinutes: t.estimateMinutes,
      actualMinutes: t.actualMinutes,
      priority: t.priority,
      tag: t.tag,
      checklist: t.checklist,
    })),
  };
}

export async function buildJournalHistory(db: Db, timezone: string, args: { days: number }) {
  const end = localNow(timezone).date;
  const start = addDays(end, -(args.days - 1));
  const entries = (await db.listRecentJournalEntries(500)).filter((e) => e.entryDate >= start && e.entryDate <= end);
  const moods: Record<string, number> = {};
  for (const e of entries) if (e.mood) moods[e.mood] = (moods[e.mood] ?? 0) + 1;
  return { window: { start, end, days: args.days }, count: entries.length, moodCounts: moods, entries };
}
