import { createClient } from '@supabase/supabase-js';
import type { InstructActionRow, InstructActionStatus } from '@habits-coach/shared';
import type { RecordedToolCall } from '../coach/events.js';
import { config } from '../config.js';

/** An `instruct_actions` row as the database returns it. */
export interface InstructActionRecord {
  id: string;
  user_id: string;
  status: InstructActionStatus;
  transcript: string;
  timezone: string;
  summary: string | null;
  result: string | null;
  error: string | null;
  tool_calls: RecordedToolCall[] | null;
  claude_session_id: string | null;
  reinstruct_of: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type InstructActionPatch = Partial<
  Pick<
    InstructActionRecord,
    'status' | 'summary' | 'result' | 'error' | 'tool_calls' | 'claude_session_id' | 'started_at' | 'finished_at'
  >
>;

/**
 * The persistence the queue runs on. One implementation talks to Supabase;
 * tests substitute an in-memory one, so the state machine is provable without
 * a database.
 */
/**
 * A new row. `id` is the client's: it names the instruction before uploading
 * it, so an upload whose reply was lost resolves to the same row instead of a
 * second instruction.
 */
type NewInstructAction = Pick<
  InstructActionRecord,
  'user_id' | 'transcript' | 'timezone' | 'reinstruct_of'
> & { id?: string };

export interface InstructActionsDb {
  /** Idempotent on `id`: a repeat of an insert already taken returns that row. */
  insert(row: NewInstructAction): Promise<InstructActionRecord>;
  get(id: string): Promise<InstructActionRecord | null>;
  /** Applies `patch` only when the row's status is in `from`; null when the guard misses. */
  transition(id: string, from: InstructActionStatus[], patch: InstructActionPatch): Promise<InstructActionRecord | null>;
  /** The user's oldest queued row, or null when the queue is drained. */
  oldestQueued(userId: string): Promise<InstructActionRecord | null>;
  list(userId: string, since?: string): Promise<InstructActionRecord[]>;
  /** Boot recovery: every `working` row (any user) back to `queued`. */
  resetStaleWorking(): Promise<void>;
  /** Users with queued rows, for the boot kick. */
  queuedUserIds(): Promise<string[]>;
}

/** The log row the app renders; the undo bookkeeping stays server-side. */
export function toApiRow(record: InstructActionRecord): InstructActionRow {
  return {
    id: record.id,
    status: record.status,
    transcript: record.transcript,
    summary: record.summary,
    result: record.result,
    error: record.error,
    createdAt: record.created_at,
    startedAt: record.started_at,
    finishedAt: record.finished_at,
  };
}

export function createSupabaseInstructActionsDb(): InstructActionsDb {
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  const table = () => supabase.from('instruct_actions');

  const get = async (id: string): Promise<InstructActionRecord | null> => {
    const { data, error } = await table().select().eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to read instruct action: ${error.message}`);
    return (data as InstructActionRecord | null) ?? null;
  };

  return {
    async insert(row) {
      const { data, error } = await table().insert(row).select().single();
      if (error) {
        // The id is the client's, so a duplicate key is the same instruction
        // arriving twice — the reply to the first attempt was lost, not the
        // upload. Hand back the row it already made.
        if (error.code === '23505' && row.id) {
          const existing = await get(row.id);
          if (existing?.user_id === row.user_id) return existing;
        }
        throw new Error(`Failed to enqueue instruction: ${error.message}`);
      }
      return data as InstructActionRecord;
    },

    get,

    async transition(id, from, patch) {
      const { data, error } = await table().update(patch).eq('id', id).in('status', from).select().maybeSingle();
      if (error) throw new Error(`Failed to update instruct action: ${error.message}`);
      return (data as InstructActionRecord | null) ?? null;
    },

    async oldestQueued(userId) {
      const { data, error } = await table()
        .select()
        .eq('user_id', userId)
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to read the instruct queue: ${error.message}`);
      return (data as InstructActionRecord | null) ?? null;
    },

    async list(userId, since) {
      let query = table().select().eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
      if (since) query = query.gte('created_at', since);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to read the instruct log: ${error.message}`);
      return (data ?? []) as InstructActionRecord[];
    },

    async resetStaleWorking() {
      const { error } = await table()
        .update({ status: 'queued', started_at: null, summary: null })
        .eq('status', 'working');
      if (error) throw new Error(`Failed to reset stale instruct actions: ${error.message}`);
    },

    async queuedUserIds() {
      const { data, error } = await table().select('user_id').eq('status', 'queued');
      if (error) throw new Error(`Failed to read queued users: ${error.message}`);
      return [...new Set((data ?? []).map((row) => (row as { user_id: string }).user_id))];
    },
  };
}
