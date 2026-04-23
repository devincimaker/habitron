import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type {
  CoachDebugEvent,
  CoachDebugEventInput,
  GetCoachDebugEventsResponse,
  JsonValue,
} from '@habits-coach/shared';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface DbCoachDebugEvent {
  id: string;
  session_id: string;
  user_id: string;
  turn_index: number | null;
  event_type: CoachDebugEvent['eventType'];
  request_payload: CoachDebugEvent['requestPayload'] | null;
  response_payload: CoachDebugEvent['responsePayload'] | null;
  proposal_payload: CoachDebugEvent['proposalPayload'] | null;
  error_message: string | null;
  error_code: string | null;
  error_stage: CoachDebugEvent['errorStage'] | null;
  metadata: CoachDebugEvent['metadata'] | null;
  created_at: string;
}

export interface LogCoachDebugEventParams {
  sessionId: string;
  userId: string;
  event: CoachDebugEventInput;
}

function toStoredJsonValue(value: unknown): JsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function mapDbCoachDebugEvent(row: DbCoachDebugEvent): CoachDebugEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    turnIndex: row.turn_index ?? undefined,
    eventType: row.event_type,
    requestPayload: row.request_payload,
    responsePayload: row.response_payload,
    proposalPayload: row.proposal_payload,
    errorMessage: row.error_message,
    errorCode: row.error_code,
    errorStage: row.error_stage,
    metadata: row.metadata,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function sessionBelongsToUser(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function logCoachDebugEvent({
  sessionId,
  userId,
  event,
}: LogCoachDebugEventParams): Promise<CoachDebugEvent> {
  const { data, error } = await supabase
    .from('coaching_session_debug_events')
    .insert({
      session_id: sessionId,
      user_id: userId,
      turn_index: event.turnIndex ?? null,
      event_type: event.eventType,
      request_payload: toStoredJsonValue(event.requestPayload),
      response_payload: toStoredJsonValue(event.responsePayload),
      proposal_payload: toStoredJsonValue(event.proposalPayload ?? null),
      error_message: event.errorMessage ?? null,
      error_code: event.errorCode ?? null,
      error_stage: event.errorStage ?? null,
      metadata: toStoredJsonValue(event.metadata ?? {}) ?? {},
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapDbCoachDebugEvent(data as DbCoachDebugEvent);
}

export async function logCoachDebugEventBestEffort(
  params: LogCoachDebugEventParams
): Promise<void> {
  try {
    await logCoachDebugEvent(params);
  } catch (error) {
    console.warn('Failed to persist coach debug event:', error);
  }
}

export async function listCoachDebugEvents(
  sessionId: string,
  userId: string
): Promise<GetCoachDebugEventsResponse['events']> {
  const { data, error } = await supabase
    .from('coaching_session_debug_events')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as DbCoachDebugEvent[]).map(mapDbCoachDebugEvent);
}
