import { supabase } from './supabase';
import type {
  DailyPlan,
  DailyPlanItem,
  DailyPlanItemOutcome,
  DailyPlanSource,
  DailyPlanStatus,
} from '@habits-coach/shared';

interface DbDailyPlan {
  id: string;
  user_id: string;
  plan_date: string;
  version: number;
  status: DailyPlanStatus;
  source: DailyPlanSource;
  parent_plan_id: string | null;
  rationale: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbDailyPlanItem {
  id: string;
  plan_id: string;
  user_id: string;
  item_type: 'habit' | 'todo' | 'note';
  habit_id: string | null;
  todo_id: string | null;
  title_snapshot: string;
  notes_snapshot: string | null;
  scheduled_time: string;
  estimate_minutes_snapshot: number | null;
  is_optional: boolean;
  position: number;
  outcome: DailyPlanItemOutcome;
  resolved_at: string | null;
}

function mapDbPlanItemToPlanItem(item: DbDailyPlanItem): DailyPlanItem {
  return {
    id: item.id,
    planId: item.plan_id,
    itemType: item.item_type,
    habitId: item.habit_id ?? undefined,
    todoId: item.todo_id ?? undefined,
    titleSnapshot: item.title_snapshot,
    notesSnapshot: item.notes_snapshot ?? undefined,
    scheduledTime: item.scheduled_time,
    estimateMinutesSnapshot: item.estimate_minutes_snapshot ?? undefined,
    isOptional: item.is_optional,
    position: item.position,
    outcome: item.outcome,
    resolvedAt: item.resolved_at ? new Date(item.resolved_at).getTime() : undefined,
  };
}

function mapDbPlanToPlan(plan: DbDailyPlan, items: DbDailyPlanItem[]): DailyPlan {
  return {
    id: plan.id,
    planDate: plan.plan_date,
    version: plan.version,
    status: plan.status,
    source: plan.source,
    parentPlanId: plan.parent_plan_id ?? undefined,
    rationale: plan.rationale ?? undefined,
    acceptedAt: plan.accepted_at ? new Date(plan.accepted_at).getTime() : undefined,
    createdAt: new Date(plan.created_at).getTime(),
    updatedAt: new Date(plan.updated_at).getTime(),
    items: items
      .sort((a, b) => a.position - b.position)
      .map(mapDbPlanItemToPlanItem),
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

async function loadPlanItems(planId: string): Promise<DbDailyPlanItem[]> {
  const { data, error } = await supabase
    .from('daily_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching daily plan items:', error);
    throw error;
  }

  return data as DbDailyPlanItem[];
}

export async function getDailyPlan(date: string): Promise<DailyPlan | null> {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('plan_date', date)
    .in('status', ['accepted', 'draft'])
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching daily plan:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  const items = await loadPlanItems(data.id);
  return mapDbPlanToPlan(data as DbDailyPlan, items);
}

export async function updateDailyPlanItemOutcome(
  itemId: string,
  outcome: DailyPlanItemOutcome
): Promise<void> {
  const resolvedAt = outcome === 'planned' ? null : new Date().toISOString();

  const { error } = await supabase
    .from('daily_plan_items')
    .update({
      outcome,
      resolved_at: resolvedAt,
    })
    .eq('id', itemId);

  if (error) {
    console.error('Error updating daily plan item outcome:', error);
    throw error;
  }
}
