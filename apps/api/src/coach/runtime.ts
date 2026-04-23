import { createClient } from '@supabase/supabase-js';
import type {
  ChatRequest,
  ChatResponse,
  CoachSkillId,
  CoachingSkillInstance,
  CoachingSkillStatus,
  UpdateSessionSkillRequest,
} from '@habits-coach/shared';
import { config } from '../config.js';
import { inferCoachSkillId } from './router.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface DbSkillInstance {
  id: string;
  session_id: string;
  user_id: string;
  skill_id: CoachSkillId;
  status: CoachingSkillStatus;
  is_lead: boolean;
  phase: string | null;
  state_json: Record<string, unknown> | null;
  activated_at: string;
  last_used_at: string;
  completed_at: string | null;
}

export interface CoachRuntimeContext {
  leadSkillId: CoachSkillId;
  leadSkill: CoachingSkillInstance | null;
  activeSkills: CoachingSkillInstance[];
  source: 'persisted' | 'inferred';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapSkillInstance(row: DbSkillInstance): CoachingSkillInstance {
  return {
    id: row.id,
    skillId: row.skill_id,
    status: row.status,
    isLead: row.is_lead,
    phase: row.phase,
    state: isRecord(row.state_json) ? row.state_json : {},
    activatedAt: new Date(row.activated_at).getTime(),
    lastUsedAt: new Date(row.last_used_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  };
}

function pickStickySpecialist(rows: DbSkillInstance[]): DbSkillInstance | null {
  const lead = rows.find((row) => row.is_lead && row.status === 'active');
  if (lead) {
    return lead;
  }

  return rows.find((row) => row.status === 'active') ?? null;
}

export function decideLeadSkillId(
  rows: Array<Pick<DbSkillInstance, 'skill_id' | 'status' | 'is_lead'>>,
  inferredSkillId: CoachSkillId
): CoachSkillId {
  if (inferredSkillId !== 'general-coach') {
    return inferredSkillId;
  }

  const lead = rows.find((row) => row.is_lead && row.status === 'active');
  if (lead) {
    return lead.skill_id;
  }

  const active = rows.find((row) => row.status === 'active');
  if (active) {
    return active.skill_id;
  }

  return 'general-coach';
}

async function listSessionSkillRows(
  sessionId: string,
  userId: string
): Promise<DbSkillInstance[]> {
  const { data, error } = await supabase
    .from('coaching_skill_instances')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as DbSkillInstance[];
}

async function clearLeadSkill(sessionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('coaching_skill_instances')
    .update({ is_lead: false })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('is_lead', true);

  if (error) {
    throw error;
  }
}

async function upsertSkillInstance(args: {
  sessionId: string;
  userId: string;
  skillId: CoachSkillId;
  status?: CoachingSkillStatus;
  phase?: string | null;
  isLead?: boolean;
  state?: Record<string, unknown>;
}): Promise<DbSkillInstance> {
  const nowIso = new Date().toISOString();

  if (args.isLead) {
    await clearLeadSkill(args.sessionId, args.userId);
  }

  const payload = {
    session_id: args.sessionId,
    user_id: args.userId,
    skill_id: args.skillId,
    status: args.status ?? 'active',
    phase: args.phase ?? null,
    is_lead: args.isLead ?? false,
    state_json: args.state ?? {},
    last_used_at: nowIso,
    completed_at: args.status === 'completed' ? nowIso : null,
  };

  const { data, error } = await supabase
    .from('coaching_skill_instances')
    .upsert(payload, { onConflict: 'session_id,skill_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as DbSkillInstance;
}

function buildVirtualRuntimeContext(skillId: CoachSkillId): CoachRuntimeContext {
  return {
    leadSkillId: skillId,
    leadSkill: null,
    activeSkills: [],
    source: 'inferred',
  };
}

export async function resolveCoachRuntimeContext(
  userId: string | undefined,
  request: ChatRequest
): Promise<CoachRuntimeContext> {
  const inferredSkillId = inferCoachSkillId(request);

  if (!userId || !request.sessionId) {
    return buildVirtualRuntimeContext(inferredSkillId);
  }

  const rows = await listSessionSkillRows(request.sessionId, userId);
  const leadSkillId = decideLeadSkillId(rows, inferredSkillId);

  if (leadSkillId === 'general-coach') {
    return buildVirtualRuntimeContext('general-coach');
  }

  const stickySkillRow = rows.find((row) => row.skill_id === leadSkillId);
  const ensuredLeadRow = await upsertSkillInstance({
    sessionId: request.sessionId,
    userId,
    skillId: leadSkillId,
    status: stickySkillRow?.status === 'completed' ? 'active' : stickySkillRow?.status ?? 'active',
    phase:
      stickySkillRow?.phase
      ?? (leadSkillId === 'day-planning'
        ? 'intake'
        : leadSkillId === 'habit-design'
          ? 'explore'
          : null),
    isLead: true,
    state: stickySkillRow?.state_json ?? {},
  });

  const refreshedRows = await listSessionSkillRows(request.sessionId, userId);
  const activeRows = refreshedRows.filter((row) => row.status === 'active');
  const fallbackLead = pickStickySpecialist(activeRows) ?? ensuredLeadRow;

  return {
    leadSkillId,
    leadSkill: mapSkillInstance(fallbackLead),
    activeSkills: activeRows.map(mapSkillInstance),
    source: 'persisted',
  };
}

function deriveSkillPhase(
  skillId: CoachSkillId,
  response: ChatResponse,
  currentPhase: string | null
): string | null {
  if (skillId === 'task-management') {
    if (response.proposal?.actions?.length) {
      return 'review';
    }

    if (/go ahead|sounds good|let me know if this sounds good|shall i go ahead/i.test(response.message)) {
      return 'review';
    }

    return currentPhase === 'accepted' ? 'accepted' : currentPhase;
  }

  if (skillId === 'habit-design') {
    const hasHabitProposal = Boolean(
      response.proposal?.actions?.some((action) => action.entity === 'habit')
    );

    if (hasHabitProposal) {
      return 'review';
    }

    if (/go ahead|sounds good|let me know if this sounds good|shall i go ahead/i.test(response.message)) {
      return 'review';
    }

    return currentPhase === 'accepted' ? 'accepted' : currentPhase ?? 'explore';
  }

  if (skillId !== 'day-planning') {
    return currentPhase;
  }

  if (response.proposal?.dailyPlanDraft) {
    return 'review';
  }

  if (currentPhase === 'accepted') {
    return 'accepted';
  }

  return 'intake';
}

function buildStatePatch(
  skillId: CoachSkillId,
  request: ChatRequest,
  response: ChatResponse
): Record<string, unknown> {
  const nowIso = new Date().toISOString();

  if (skillId === 'task-management') {
    return {
      lastInteractionAt: nowIso,
      pendingActionCount: response.proposal?.actions?.length ?? 0,
      lastResponseMode: response.proposal?.actions?.length ? 'proposal' : 'conversation',
    };
  }

  if (skillId === 'habit-design') {
    const habitActions = response.proposal?.actions?.filter((action) => action.entity === 'habit') ?? [];

    return {
      lastInteractionAt: nowIso,
      pendingActionCount: habitActions.length,
      lastResponseMode: habitActions.length ? 'proposal' : 'conversation',
      lastHabitOperation: habitActions[0]?.operation ?? null,
    };
  }

  if (skillId !== 'day-planning') {
    return {};
  }

  return {
    lastPlanDate: response.proposal?.dailyPlanDraft?.date ?? request.today ?? null,
    lastResponseMode: response.proposal?.dailyPlanDraft ? 'draft' : 'conversation',
    hasDraft: Boolean(response.proposal?.dailyPlanDraft),
    draftItemCount: response.proposal?.dailyPlanDraft?.items.length ?? 0,
    lastInteractionAt: nowIso,
  };
}

export async function syncCoachRuntimeAfterResponse(args: {
  userId: string | undefined;
  request: ChatRequest;
  response: ChatResponse;
  runtimeContext: CoachRuntimeContext;
}): Promise<void> {
  const { userId, request, response, runtimeContext } = args;

  if (!userId || !request.sessionId || runtimeContext.leadSkillId === 'general-coach') {
    return;
  }

  const mergedState = {
    ...(runtimeContext.leadSkill?.state ?? {}),
    ...buildStatePatch(runtimeContext.leadSkillId, request, response),
  };

  await upsertSkillInstance({
    sessionId: request.sessionId,
    userId,
    skillId: runtimeContext.leadSkillId,
    status: 'active',
    phase: deriveSkillPhase(
      runtimeContext.leadSkillId,
      response,
      runtimeContext.leadSkill?.phase ?? null
    ),
    isLead: true,
    state: mergedState,
  });
}

export async function updateSessionSkillInstance(args: {
  sessionId: string;
  userId: string;
  skillId: CoachSkillId;
  updates: UpdateSessionSkillRequest;
}): Promise<CoachingSkillInstance> {
  const rows = await listSessionSkillRows(args.sessionId, args.userId);
  const current = rows.find((row) => row.skill_id === args.skillId);

  const mergedState = {
    ...(isRecord(current?.state_json) ? current.state_json : {}),
    ...(args.updates.statePatch ?? {}),
  };

  const row = await upsertSkillInstance({
    sessionId: args.sessionId,
    userId: args.userId,
    skillId: args.skillId,
    status: args.updates.status ?? current?.status ?? 'active',
    phase:
      args.updates.phase !== undefined
        ? args.updates.phase
        : current?.phase ?? null,
    isLead: args.updates.isLead ?? current?.is_lead ?? false,
    state: mergedState,
  });

  return mapSkillInstance(row);
}

export async function getSessionSkillInstances(
  sessionId: string,
  userId: string
): Promise<CoachingSkillInstance[]> {
  const rows = await listSessionSkillRows(sessionId, userId);
  return rows.map(mapSkillInstance);
}
