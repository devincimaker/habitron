import { createClient } from '@supabase/supabase-js';
import type { CoachTurnRecord } from '@habits-coach/shared';
import { config } from '../config.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

export interface CoachSession {
  id: string;
  /** Agent SDK session the coach's own transcript lives in; null before the first turn. */
  claudeSessionId: string | null;
}

/** The session, if it exists and belongs to the user. */
export async function findCoachSession(sessionId: string, userId: string): Promise<CoachSession | null> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .select('id, claude_session_id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? { id: data.id, claudeSessionId: data.claude_session_id ?? null } : null;
}

/** The session's last turn; null before its first turn, and for a session that is not the user's. */
export async function findTurn(sessionId: string, userId: string): Promise<CoachTurnRecord | null> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .select('last_turn')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.last_turn as CoachTurnRecord | null) ?? null;
}

/**
 * Records where the session's current turn stands, so the app can read the
 * reply back after its stream dropped. Called when the turn starts and again
 * when it ends — with the Agent SDK session id once the first turn has one.
 */
export async function recordTurn(
  sessionId: string,
  userId: string,
  turn: CoachTurnRecord,
  claudeSessionId?: string
): Promise<void> {
  const { error } = await supabase
    .from('coaching_sessions')
    .update(claudeSessionId ? { last_turn: turn, claude_session_id: claudeSessionId } : { last_turn: turn })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
