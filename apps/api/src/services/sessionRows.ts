import { createClient } from '@supabase/supabase-js';
import type {
  CoachingSessionDetail,
  CoachingSessionMessage,
  MemoryCategory,
  SessionOpener,
} from '@habits-coach/shared';
import { config } from '../config.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

/** A `coaching_sessions` row, as the service role reads it. */
export interface DbSession {
  id: string;
  user_id: string;
  name: string | null;
  messages: CoachingSessionMessage[];
  started_at: string;
  ended_at: string | null;
  opener: SessionOpener;
  ritual_date: string | null;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

/** A `memories` row, as the service role reads it. */
export interface DbMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  session_id: string | null;
  source_session_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The openers the column's CHECK accepts; anything else is a 400, not a 500. */
export const SESSION_OPENERS: SessionOpener[] = ['coach', 'plan-day', 'review-day', 'review-goals'];

export function toSessionDetail(s: DbSession, memories: DbMemory[]): CoachingSessionDetail {
  return {
    id: s.id,
    name: s.name,
    startedAt: new Date(s.started_at).getTime(),
    endedAt: s.ended_at ? new Date(s.ended_at).getTime() : null,
    opener: s.opener,
    ritualDate: s.ritual_date,
    messages: s.messages || [],
    memories: memories.map((memory) => ({
      id: memory.id,
      content: memory.content,
      category: memory.category,
      sessionId: memory.session_id,
      sourceSessionAt: memory.source_session_at
        ? new Date(memory.source_session_at).getTime()
        : undefined,
      createdAt: new Date(memory.created_at).getTime(),
      updatedAt: new Date(memory.updated_at).getTime(),
    })),
  };
}

export async function loadSessionMemories(sessionId: string): Promise<DbMemory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbMemory[];
}
