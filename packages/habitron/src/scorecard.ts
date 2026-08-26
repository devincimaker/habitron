import type { DailyPlanItem, DailyPlanItemOutcome } from '@habits-coach/shared';
import type { HabitForDay } from './context.js';
import type { Task } from './db.js';

const DONE_OUTCOMES: DailyPlanItemOutcome[] = ['completed_as_planned', 'completed_after_adjustment'];
/** Deliberately taken off the plan — not residue, and not a slip. */
const DROPPED_OUTCOMES: DailyPlanItemOutcome[] = ['removed', 'canceled'];

/**
 * A weekly habit with no pinned days owes N times a week, not something today.
 * `isHabitDue` surfaces it every day so the app can show week progress, which is
 * the right call there and the wrong number to count as a miss.
 */
function isFlexibleWeekly(habit: HabitForDay): boolean {
  return habit.frequency === 'weekly' && !habit.weeklyDays?.length;
}

/** The day already counted, so a review never asks for a number it can compute. */
export interface Scorecard {
  plan: {
    items: number;
    done: number;
    dropped: number;
    /** Didn't happen and wasn't dropped — still `planned`, deferred, or not done. */
    residue: number;
    residueTitles: string[];
  } | null;
  /** Habits that owed something today. Flexible weekly habits are in `habitsThisWeek`. */
  habits: { due: number; logged: number };
  habitsThisWeek: { name: string; completed: number; target: number }[];
  tasks: {
    completed: number;
    estimatedMinutes: number;
    actualMinutes: number;
    /** Actual where logged, estimate where not — this is what `minutesByTag` sums. */
    trackedMinutes: number;
  };
  minutesByTag: Record<string, number>;
}

interface ScorecardInput {
  planItems: DailyPlanItem[] | null;
  habits: HabitForDay[];
  completedTasks: Task[];
}

/**
 * The day in numbers, from the tables that already hold them. Nothing here is
 * stored on `day_reviews`: adherence, habit counts and minutes are recomputed
 * every read, so editing a task later never leaves a stale snapshot behind.
 *
 * `residue` is what the review reads out in a single batched question, which is
 * why an item still sitting at `planned` counts towards it: at review time,
 * unresolved and not-done are the same thing to ask about. Note items are
 * excluded from the plan counts entirely — they are guidance text with nothing
 * to do and nothing to resolve, so counting one would report a miss that cannot
 * happen and then ask the user to reschedule a sentence.
 */
export function buildScorecard({ planItems, habits, completedTasks }: ScorecardInput): Scorecard {
  const actionable = (planItems ?? []).filter((i) => i.itemType !== 'note');
  const residue = actionable.filter(
    (i) => !DONE_OUTCOMES.includes(i.outcome) && !DROPPED_OUTCOMES.includes(i.outcome)
  );

  const minutesOf = (task: Task) => task.actualMinutes ?? task.estimateMinutes ?? 0;
  const minutesByTag: Record<string, number> = {};
  for (const task of completedTasks) {
    const key = task.tag?.name ?? 'untagged';
    minutesByTag[key] = (minutesByTag[key] ?? 0) + minutesOf(task);
  }

  const dueToday = habits.filter((h) => h.dueOnDate && !isFlexibleWeekly(h));

  return {
    plan: planItems
      ? {
          items: actionable.length,
          done: actionable.filter((i) => DONE_OUTCOMES.includes(i.outcome)).length,
          dropped: actionable.filter((i) => DROPPED_OUTCOMES.includes(i.outcome)).length,
          residue: residue.length,
          residueTitles: residue.map((i) => i.titleSnapshot),
        }
      : null,
    habits: {
      due: dueToday.length,
      logged: dueToday.filter((h) => h.statusOnDate === 'completed').length,
    },
    habitsThisWeek: habits.filter(isFlexibleWeekly).map((h) => ({
      name: h.name,
      completed: h.completedThisWeek,
      target: h.weeklyCount ?? 1,
    })),
    tasks: {
      completed: completedTasks.length,
      estimatedMinutes: completedTasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0),
      actualMinutes: completedTasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0),
      trackedMinutes: completedTasks.reduce((sum, t) => sum + minutesOf(t), 0),
    },
    minutesByTag,
  };
}
