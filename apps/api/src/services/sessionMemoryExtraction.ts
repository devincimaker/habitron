import { createClient } from '@supabase/supabase-js';
import type { CoachingSessionMessage, MemoryCategory } from '@habits-coach/shared';
import { config } from '../config.js';
import { extractMemories } from './memories.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface DbSession {
  id: string;
  user_id: string;
  started_at: string;
  messages: CoachingSessionMessage[];
  memory_extraction_status: string;
}

interface DbMemory {
  content: string;
  category: MemoryCategory;
}

export function queueSessionMemoryExtraction(args: {
  sessionId: string;
  userId: string;
}): void {
  void runSessionMemoryExtraction(args).catch((error) => {
    console.error('Queued session memory extraction failed:', error);
  });
}

async function runSessionMemoryExtraction(args: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  const { data: session, error: sessionError } = await supabase
    .from('coaching_sessions')
    .select('id, user_id, started_at, messages, memory_extraction_status')
    .eq('id', args.sessionId)
    .eq('user_id', args.userId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const s = session as DbSession;
  if (s.memory_extraction_status === 'running' || s.memory_extraction_status === 'completed') {
    return;
  }

  try {
    const { error: markRunningError } = await supabase
      .from('coaching_sessions')
      .update({
        memory_extraction_status: 'running',
        memory_extraction_error: null,
      })
      .eq('id', args.sessionId)
      .eq('user_id', args.userId);

    if (markRunningError) {
      throw markRunningError;
    }

    const messages = s.messages ?? [];
    if (messages.length > 2) {
      const { data: existingMemories, error: existingError } = await supabase
        .from('memories')
        .select('content, category')
        .eq('user_id', args.userId);

      if (existingError) {
        throw existingError;
      }

      const { memories } = await extractMemories(
        messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        ((existingMemories ?? []) as DbMemory[]).map((memory) => ({
          content: memory.content,
          category: memory.category,
        }))
      );

      if (memories.length > 0) {
        const { error: insertError } = await supabase.from('memories').insert(
          memories.map((memory) => ({
            user_id: args.userId,
            content: memory.content,
            category: memory.category,
            session_id: args.sessionId,
            source_session_at: s.started_at,
          }))
        );

        if (insertError) {
          throw insertError;
        }
      }
    }

    const { error: markCompletedError } = await supabase
      .from('coaching_sessions')
      .update({
        memory_extraction_status: 'completed',
        memory_extracted_at: new Date().toISOString(),
        memory_extraction_error: null,
      })
      .eq('id', args.sessionId)
      .eq('user_id', args.userId);

    if (markCompletedError) {
      throw markCompletedError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown memory extraction error';

    await supabase
      .from('coaching_sessions')
      .update({
        memory_extraction_status: 'failed',
        memory_extraction_error: message,
      })
      .eq('id', args.sessionId)
      .eq('user_id', args.userId);

    throw error;
  }
}
