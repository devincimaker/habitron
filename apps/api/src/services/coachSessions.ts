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

export async function setClaudeSessionId(
  sessionId: string,
  userId: string,
  claudeSessionId: string
): Promise<void> {
  const { error } = await supabase
    .from('coaching_sessions')
    .update({ claude_session_id: claudeSessionId })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Records where the session's current turn stands, so the app can read the
 * reply back after its stream dropped. Called when the turn starts and again
 * when it ends; the next turn overwrites it.
 */
export async function recordTurn(sessionId: string, userId: string, turn: CoachTurnRecord): Promise<void> {
  const { error } = await supabase
    .from('coaching_sessions')
    .update({ last_turn: turn })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
