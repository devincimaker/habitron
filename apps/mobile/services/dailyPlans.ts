import { supabase } from './supabase';
import type {
  DailyPlan,
  DailyPlanDraft,
  DailyPlanDraftItem,
  DailyPlanItem,
  DailyPlanItemOutcome,
  DailyPlanItemType,
  DailyPlanSource,
  DailyPlanStatus,
} from '@habits-coach/shared';
import { normalizeTodoScheduledTimeInput } from '../utils/todoTime';

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
  item_type: DailyPlanItemType;
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

function serializePlannedScheduledTime(time: string): string {
  const normalizedTime = normalizeTodoScheduledTimeInput(time);

  if (!normalizedTime) {
    throw new Error('Invalid planned scheduled time');
  }

  return normalizedTime;
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

async function getLatestPlanVersion(userId: string, date: string): Promise<number> {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('version')
    .eq('user_id', userId)
    .eq('plan_date', date)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest daily plan version:', error);
    throw error;
  }

  return data?.version ?? 0;
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

export async function saveAcceptedDailyPlan(
  draft: DailyPlanDraft,
  resolvedRefs: Map<string, string>,
  source: DailyPlanSource = 'coach',
  parentPlanId?: string
): Promise<DailyPlan> {
  const userId = await getCurrentUserId();
  const nextVersion = (await getLatestPlanVersion(userId, draft.date)) + 1;

  const { error: supersedeError } = await supabase
    .from('daily_plans')
    .update({ status: 'superseded' })
    .eq('user_id', userId)
    .eq('plan_date', draft.date)
    .in('status', ['accepted', 'draft']);

  if (supersedeError) {
    console.error('Error superseding daily plans:', supersedeError);
    throw supersedeError;
  }

  const { data: planData, error: planError } = await supabase
    .from('daily_plans')
    .insert({
      user_id: userId,
      plan_date: draft.date,
      version: nextVersion,
      status: 'accepted',
      source,
      parent_plan_id: parentPlanId ?? null,
      rationale: draft.rationale ?? null,
      accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (planError) {
    console.error('Error creating daily plan:', planError);
    throw planError;
  }

  const itemRows = draft.items.map((item, index) => {
    const resolved = resolveDraftItemReference(item, resolvedRefs);

    return {
      plan_id: planData.id,
      user_id: userId,
      item_type: item.itemType,
      habit_id: resolved.habitId,
      todo_id: resolved.todoId,
      title_snapshot: item.title,
      notes_snapshot: item.notes ?? null,
      scheduled_time: serializePlannedScheduledTime(item.scheduledTime),
      estimate_minutes_snapshot: item.estimateMinutes ?? null,
      is_optional: item.isOptional ?? false,
      position: index,
    };
  });

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from('daily_plan_items')
      .insert(itemRows);

    if (itemsError) {
      console.error('Error creating daily plan items:', itemsError);
      throw itemsError;
    }
  }

  const items = await loadPlanItems(planData.id);
  return mapDbPlanToPlan(planData as DbDailyPlan, items);
}

function resolveDraftItemReference(
  item: DailyPlanDraftItem,
  resolvedRefs: Map<string, string>
): { habitId: string | null; todoId: string | null } {
  if (!item.ref) {
    return { habitId: null, todoId: null };
  }

  if (item.ref.kind === 'habit') {
    return { habitId: item.ref.id, todoId: null };
  }

  if (item.ref.kind === 'todo') {
    return { habitId: null, todoId: item.ref.id };
  }

  const resolvedId = resolvedRefs.get(item.ref.clientKey);
  if (!resolvedId) {
    return { habitId: null, todoId: null };
  }

  if (item.itemType === 'habit') {
    return { habitId: resolvedId, todoId: null };
  }

  if (item.itemType === 'todo') {
    return { habitId: null, todoId: resolvedId };
  }

  return { habitId: null, todoId: null };
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
