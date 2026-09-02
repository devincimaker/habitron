import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task } from './db.js';
import { unwrap } from './supabaseResult.js';

interface DbGoal {
  id: string;
  title: string;
  measure: string;
  target_date: string;
  completed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A goal as the coach reads it: an outcome that ends. `measure` is how the user
 * will know it is done, `targetDate` is by when. Open or done is read from
 * `completedAt`; `reviewedAt` is what the goals review stamps.
 */
export interface GoalRecord {
  id: string;
  title: string;
  measure: string;
  /** YYYY-MM-DD. */
  targetDate: string;
  completedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  measure: string;
  targetDate: string;
}

/** `undefined` leaves a field alone. The two stamps are ISO instants. */
export interface GoalPatch {
  title?: string;
  measure?: string;
  targetDate?: string;
  completedAt?: string;
  reviewedAt?: string;
}

const GOAL_COLUMNS = 'id, title, measure, target_date, completed_at, reviewed_at, created_at, updated_at';

function mapGoal(row: DbGoal): GoalRecord {
  return {
    id: row.id,
    title: row.title,
    measure: row.measure,
    targetDate: row.target_date,
    completedAt: row.completed_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The `goals` reads and writes for one user; spread into `createDb`. */
export function createGoalsDb(supabase: SupabaseClient, userId: string) {
  /** Nearest target first; `created_at` breaks ties so the order holds between turns. */
  async function listGoals(): Promise<GoalRecord[]> {
    const rows = unwrap(
      await supabase
        .from('goals')
        .select(GOAL_COLUMNS)
        .eq('user_id', userId)
        .order('target_date', { ascending: true })
        .order('created_at', { ascending: true })
    ) as DbGoal[];
    return rows.map(mapGoal);
  }

  async function getGoal(id: string): Promise<GoalRecord> {
    const row = unwrap(
      await supabase.from('goals').select(GOAL_COLUMNS).eq('user_id', userId).eq('id', id).maybeSingle()
    ) as DbGoal | null;
    if (!row) {
      throw new Error(`Goal not found: ${id}. Call list_goals to see the goals.`);
    }
    return mapGoal(row);
  }

  /** The same check `tagId` gets: a task can only point at a goal that exists. */
  async function assertGoalExists(id: string): Promise<void> {
    await getGoal(id);
  }

  async function createGoal(input: GoalInput): Promise<GoalRecord> {
    const row = unwrap(
      await supabase
        .from('goals')
        .insert({
          user_id: userId,
          title: input.title,
          measure: input.measure,
          target_date: input.targetDate,
        })
        .select(GOAL_COLUMNS)
        .single()
    ) as DbGoal;
    return mapGoal(row);
  }

  async function updateGoal(id: string, patch: GoalPatch): Promise<GoalRecord> {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.measure !== undefined) update.measure = patch.measure;
    if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
    if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
    if (patch.reviewedAt !== undefined) update.reviewed_at = patch.reviewedAt;

    if (Object.keys(update).length === 0) return getGoal(id);

    const row = unwrap(
      await supabase
        .from('goals')
        .update(update)
        .eq('user_id', userId)
        .eq('id', id)
        .select(GOAL_COLUMNS)
        .maybeSingle()
    ) as DbGoal | null;
    if (!row) {
      throw new Error(`Goal not found: ${id}. Call list_goals to see the goals.`);
    }
    return mapGoal(row);
  }

  /** Its tasks stay: `todos.goal_id` nulls by the FK. */
  async function deleteGoal(id: string): Promise<void> {
    unwrap(await supabase.from('goals').delete().eq('user_id', userId).eq('id', id));
  }

  return { listGoals, assertGoalExists, createGoal, updateGoal, deleteGoal };
}

function daysUntil(targetDate: string, today: string): number {
  return Math.round(
    (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  );
}

/** The tasks pointing at a goal, canceled ones left out: they no longer move it. */
function tasksOf(goalId: string, tasks: Task[]): Task[] {
  return tasks.filter((task) => task.goalId === goalId && task.status !== 'canceled');
}

export interface GoalForDay extends GoalRecord {
  /** Whole days from `date` to the target; negative once past. */
  daysLeft: number;
  tasks: { done: number; total: number };
}

/**
 * The open goals as the day packet carries them: what each one is, how long is
 * left, and how much of the work pointing at it is done. Done goals stay out —
 * planning is about the open ones — and nearest target comes first, the order
 * `listGoals` already gives.
 */
export function goalsForDay(goals: GoalRecord[], tasks: Task[], date: string): GoalForDay[] {
  return goals
    .filter((goal) => !goal.completedAt)
    .map((goal) => {
      const own = tasksOf(goal.id, tasks);
      return {
        ...goal,
        daysLeft: daysUntil(goal.targetDate, date),
        tasks: { done: own.filter((task) => task.status === 'completed').length, total: own.length },
      };
    });
}

export interface GoalWithTasks extends GoalRecord {
  daysLeft: number;
  tasks: Pick<Task, 'id' | 'title' | 'status' | 'scheduledDate' | 'completedAt'>[];
}

/** `list_goals`: every goal with the tasks that point at it, so a review never has to cross-reference. */
export function goalsWithTasks(
  goals: GoalRecord[],
  tasks: Task[],
  today: string,
  includeDone: boolean
): GoalWithTasks[] {
  return goals
    .filter((goal) => includeDone || !goal.completedAt)
    .map((goal) => ({
      ...goal,
      daysLeft: daysUntil(goal.targetDate, today),
      tasks: tasksOf(goal.id, tasks).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        scheduledDate: task.scheduledDate,
        completedAt: task.completedAt,
      })),
    }));
}
