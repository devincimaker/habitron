import { createClient } from '@supabase/supabase-js';
import type { CoachTurnRecord } from '@habits-coach/shared';
import { config } from '../config.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

export interface CoachSession {
  id: string;
  /** Agent SDK session the coach's own transcript lives in; null before the first turn. */
  claudeSessionId: string | null;
  /** The session's last coach turn; null before its first. */
  lastTurn: CoachTurnRecord | null;
}

/** The session, if it exists and belongs to the user. */
export async function findCoachSession(sessionId: string, userId: string): Promise<CoachSession | null> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .select('id, claude_session_id, last_turn')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? {
        id: data.id,
        claudeSessionId: data.claude_session_id ?? null,
        lastTurn: (data.last_turn as CoachTurnRecord | null) ?? null,
      }
    : null;
}

/**
 * Records where the session's current turn stands, so the app can read the
 * reply back after its stream dropped. Called when the turn starts and again
 * when it ends — with the Agent SDK session id the turn ran in, once it has one.
 */
export async function recordTurn(
  sessionId: string,
  userId: string,
  turn: CoachTurnRecord,
  claudeSessionId: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('coaching_sessions')
    .update({ last_turn: turn, ...(claudeSessionId ? { claude_session_id: claudeSessionId } : {}) })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
