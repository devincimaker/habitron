import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { generateSessionSummary } from '../services/sessions.js';
import { extractMemories } from '../services/memories.js';
import type {
  CoachingSessionMessage,
  CoachingSessionSummary,
  CreateSessionRequest,
  UpdateSessionRequest,
  FinalizeSessionRequest,
  ErrorResponse,
  MemoryCategory,
} from '@habits-coach/shared';

const router: Router = Router();
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Database row types
interface DbSession {
  id: string;
  user_id: string;
  name: string | null;
  messages: CoachingSessionMessage[];
  started_at: string;
  ended_at: string | null;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

interface DbMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  session_id: string | null;
  source_session_at: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/sessions - List sessions (last 50)
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get sessions with memory count
    const { data: sessions, error } = await supabase
      .from('coaching_sessions')
      .select('id, name, messages, started_at, ended_at')
      .eq('user_id', req.user!.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Get memory counts per session
    const sessionIds = (sessions as DbSession[]).map(s => s.id);
    const { data: memoryCounts, error: countError } = await supabase
      .from('memories')
      .select('session_id')
      .in('session_id', sessionIds);

    if (countError) throw countError;

    // Count memories per session
    const memoryCountMap = new Map<string, number>();
    for (const m of memoryCounts || []) {
      const count = memoryCountMap.get(m.session_id) || 0;
      memoryCountMap.set(m.session_id, count + 1);
    }

    const result: CoachingSessionSummary[] = (sessions as DbSession[]).map(s => ({
      id: s.id,
      name: s.name,
      startedAt: new Date(s.started_at).getTime(),
      endedAt: s.ended_at ? new Date(s.ended_at).getTime() : null,
      messageCount: s.messages?.length || 0,
      memoryCount: memoryCountMap.get(s.id) || 0,
    }));

    res.json({ sessions: result });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' } satisfies ErrorResponse);
  }
});

// GET /api/sessions/active - Get active (unprocessed) session if exists
router.get('/active', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('is_processed', false)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;  // PGRST116 = no rows

    if (!data) {
      res.json({ session: null });
      return;
    }

    const session = data as DbSession;
    res.json({
      session: {
        id: session.id,
        name: session.name,
        startedAt: new Date(session.started_at).getTime(),
        endedAt: null,
        messageCount: session.messages?.length || 0,
        messages: session.messages || [],
        updatedAt: new Date(session.updated_at).getTime(),
      },
    });
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Failed to fetch active session' } satisfies ErrorResponse);
  }
});

// GET /api/sessions/:id - Get session detail with memories
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: session, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error) throw error;
    if (!session) {
      res.status(404).json({ error: 'Session not found' } satisfies ErrorResponse);
      return;
    }

    // Get related memories
    const { data: memories, error: memError } = await supabase
      .from('memories')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (memError) throw memError;

    const s = session as DbSession;
    res.json({
      session: {
        id: s.id,
        name: s.name,
        startedAt: new Date(s.started_at).getTime(),
        endedAt: s.ended_at ? new Date(s.ended_at).getTime() : null,
        messageCount: s.messages?.length || 0,
        messages: s.messages || [],
        memories: (memories as DbMemory[]).map(m => ({
          id: m.id,
          content: m.content,
          category: m.category,
          sessionId: m.session_id,
          sourceSessionAt: m.source_session_at ? new Date(m.source_session_at).getTime() : undefined,
          createdAt: new Date(m.created_at).getTime(),
          updatedAt: new Date(m.updated_at).getTime(),
        })),
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' } satisfies ErrorResponse);
  }
});

// POST /api/sessions - Create new session
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { startedAt } = req.body as CreateSessionRequest;

    const { data, error } = await supabase
      .from('coaching_sessions')
      .insert({
        user_id: req.user!.id,
        started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
        messages: [],
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      session: {
        id: data.id,
        startedAt: new Date(data.started_at).getTime(),
      },
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' } satisfies ErrorResponse);
  }
});

// PUT /api/sessions/:id - Update session (add messages, etc.)
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { messages, name, endedAt, isProcessed } = req.body as UpdateSessionRequest;

    const updates: Record<string, unknown> = {};
    if (messages !== undefined) updates.messages = messages;
    if (name !== undefined) updates.name = name;
    if (endedAt !== undefined) updates.ended_at = new Date(endedAt).toISOString();
    if (isProcessed !== undefined) updates.is_processed = isProcessed;

    const { data, error } = await supabase
      .from('coaching_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Session not found' } satisfies ErrorResponse);
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' } satisfies ErrorResponse);
  }
});

// POST /api/sessions/:id/finalize - End session with summary and memory extraction
router.post('/:id/finalize', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { generateSummary = true, extractMemories: shouldExtract = true } = req.body as FinalizeSessionRequest;

    // Get session
    const { data: session, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error) throw error;
    if (!session) {
      res.status(404).json({ error: 'Session not found' } satisfies ErrorResponse);
      return;
    }

    const s = session as DbSession;
    const messages = s.messages || [];
    let sessionName = s.name;

    // Generate summary if requested and session has content
    if (generateSummary && messages.length > 2 && !sessionName) {
      try {
        sessionName = await generateSessionSummary(messages);
      } catch (err) {
        console.error('Failed to generate summary:', err);
        // Fallback name
        const date = new Date(s.started_at);
        sessionName = `Session on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
    } else if (!sessionName) {
      // Fallback for short sessions
      const date = new Date(s.started_at);
      sessionName = `Session on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    // Extract memories if requested and session has content
    if (shouldExtract && messages.length > 2) {
      try {
        // Get existing memories for deduplication
        const { data: existingMemories } = await supabase
          .from('memories')
          .select('content, category')
          .eq('user_id', req.user!.id);

        const { memories: extractedMemories } = await extractMemories(
          messages.map(m => ({ role: m.role, content: m.content })),
          existingMemories || []
        );

        // Save extracted memories with session_id
        if (extractedMemories.length > 0) {
          const memoriesData = extractedMemories.map(m => ({
            user_id: req.user!.id,
            content: m.content,
            category: m.category,
            session_id: id,
            source_session_at: s.started_at,
          }));

          await supabase.from('memories').insert(memoriesData);
        }
      } catch (err) {
        console.error('Failed to extract memories:', err);
        // Continue even if memory extraction fails
      }
    }

    // Update session as finalized
    const { error: updateError } = await supabase
      .from('coaching_sessions')
      .update({
        name: sessionName,
        ended_at: new Date().toISOString(),
        is_processed: true,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      name: sessionName,
    });
  } catch (error) {
    console.error('Finalize session error:', error);
    res.status(500).json({ error: 'Failed to finalize session' } satisfies ErrorResponse);
  }
});

// DELETE /api/sessions/:id - Delete session (cascades to memories)
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('coaching_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' } satisfies ErrorResponse);
  }
});

export default router;
