import type { Goal, Todo } from '@habits-coach/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a goal may go unreviewed before the review card turns into a nudge.
 * A constant, not a setting: reviews happen whenever, and this only decides
 * when the card stops being quiet about it.
 */
const GOAL_REVIEW_EVERY_DAYS = 7;

// Built once: an Intl formatter is the expensive half of formatting, and a list
// of goals asks for one per card.
const GOAL_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** `Mar 1, 2027` — a goal's date carries its year, since goals live longer than tasks. */
export function formatGoalDate(dateStr: string): string {
  return GOAL_DATE.format(new Date(`${dateStr}T00:00:00`));
}

/** A timestamp as the YYYY-MM-DD it fell on locally, which is the day it happened. */
export function toLocalDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function isGoalOpen(goal: Pick<Goal, 'completedAt'>): boolean {
  return goal.completedAt === undefined;
}

/** Whole days from `today` (YYYY-MM-DD) to the target date; negative once past. */
export function daysUntil(targetDate: string, today: string): number {
  const target = Date.UTC(
    Number(targetDate.slice(0, 4)),
    Number(targetDate.slice(5, 7)) - 1,
    Number(targetDate.slice(8, 10))
  );
  const now = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10))
  );
  return Math.round((target - now) / DAY_MS);
}

/** "180 days left", "Due today", "12 days over" — the goal's clock, in words. */
export function describeDaysLeft(targetDate: string, today: string): string {
  const days = daysUntil(targetDate, today);
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  if (days === -1) return '1 day over';
  return days > 0 ? `${days} days left` : `${-days} days over`;
}

export interface GoalTaskCounts {
  done: number;
  total: number;
}

/** The tasks pointing at a goal: open ones and finished ones, canceled left out. */
export function countGoalTasks(goalId: string, todos: Todo[]): GoalTaskCounts {
  let done = 0;
  let total = 0;
  for (const todo of todos) {
    if (todo.goalId !== goalId || todo.status === 'canceled') continue;
    total += 1;
    if (todo.status === 'completed') done += 1;
  }
  return { done, total };
}

/**
 * The card's third line: the date, the clock, and the task count when there
 * is one. A done goal reads its completion date instead.
 */
export function describeGoalMeta(goal: Goal, counts: GoalTaskCounts, today: string): string {
  if (goal.completedAt !== undefined) {
    return `Done ${formatGoalDate(toLocalDateString(goal.completedAt))}`;
  }
  const parts = [formatGoalDate(goal.targetDate), describeDaysLeft(goal.targetDate, today)];
  if (counts.total > 0) parts.push(`${counts.done} of ${counts.total} tasks done`);
  return parts.join(' · ');
}

/** Whole days since a timestamp, on the local calendar of `today`. */
function daysSince(timestamp: number, today: string): number {
  return -daysUntil(toLocalDateString(timestamp), today);
}

export interface GoalReviewState {
  /** The review is owed: a goal is unreviewed, or the oldest review is a week old. */
  due: boolean;
  label: string;
}

/**
 * What the Review goals card says. It reads the *oldest* review among open
 * goals, so a goal added since the last pass is what makes the card speak.
 */
export function goalReviewState(goals: Goal[], today: string): GoalReviewState {
  const open = goals.filter(isGoalOpen);
  if (open.length === 0) return { due: false, label: 'Nothing to review' };
  const unreviewed = open.filter((goal) => goal.reviewedAt === undefined).length;
  if (unreviewed > 0) {
    return {
      due: true,
      label: unreviewed === 1 ? '1 goal not yet reviewed' : `${unreviewed} goals not yet reviewed`,
    };
  }
  const oldest = Math.min(...open.map((goal) => goal.reviewedAt as number));
  const days = daysSince(oldest, today);
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  const due = days >= GOAL_REVIEW_EVERY_DAYS;
  return { due, label: due ? `Due · last reviewed ${ago}` : `Reviewed ${ago}` };
}

/** The goal's own review line: when the coach last looked at it. */
export function describeReviewedAt(goal: Goal, today: string): string {
  if (goal.reviewedAt === undefined) return 'Not reviewed yet';
  const days = daysSince(goal.reviewedAt, today);
  if (days <= 0) return 'Reviewed today';
  return days === 1 ? 'Reviewed yesterday' : `Reviewed ${days} days ago`;
}
