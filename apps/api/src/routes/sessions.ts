import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { generateSessionSummary } from '../services/sessions.js';
import { extractMemories } from '../services/memories.js';
import {
  SESSION_OPENERS,
  loadSessionMemories,
  toSessionDetail,
  type DbSession,
} from '../services/sessionRows.js';
import type {
  CoachingSessionSummary,
  CreateSessionRequest,
  UpdateSessionRequest,
  FinalizeSessionRequest,
  ErrorResponse,
} from '@habits-coach/shared';

const router: Router = Router();
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// GET /api/sessions - List sessions (last 50)
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: sessions, error } = await supabase
      .from('coaching_sessions')
      .select('id, name, started_at, ended_at, opener, ritual_date')
      .eq('user_id', req.user!.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const sessionRows = (sessions ?? []) as Pick<
      DbSession,
      'id' | 'name' | 'started_at' | 'ended_at' | 'opener' | 'ritual_date'
    >[];
    const sessionIds = sessionRows.map((session) => session.id);

    let memoryCountMap = new Map<string, number>();

    if (sessionIds.length > 0) {
      const { data: memoryCounts, error: countError } = await supabase
        .from('memories')
        .select('session_id')
        .in('session_id', sessionIds);

      if (countError) throw countError;

      memoryCountMap = (memoryCounts || []).reduce((map, memory) => {
        const sessionId = memory.session_id as string | null;
        if (sessionId) {
          map.set(sessionId, (map.get(sessionId) || 0) + 1);
        }
        return map;
      }, new Map<string, number>());
    }

    const result: CoachingSessionSummary[] = sessionRows.map((session) => ({
      id: session.id,
      name: session.name,
      startedAt: new Date(session.started_at).getTime(),
      endedAt: session.ended_at ? new Date(session.ended_at).getTime() : null,
      memoryCount: memoryCountMap.get(session.id) || 0,
      opener: session.opener,
      ritualDate: session.ritual_date,
    }));

    res.json({ sessions: result });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' } satisfies ErrorResponse);
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

    const memories = await loadSessionMemories(id);

    res.json({ session: toSessionDetail(session as DbSession, memories) });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' } satisfies ErrorResponse);
  }
});

// POST /api/sessions - Create new session
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { startedAt, opener = 'coach', ritualDate } = req.body as CreateSessionRequest;

    if (!SESSION_OPENERS.includes(opener)) {
      res.status(400).json({
        error: `opener must be one of ${SESSION_OPENERS.join(', ')}`,
      } satisfies ErrorResponse);
      return;
    }

    if ((opener === 'coach') !== (ritualDate === undefined)) {
      res.status(400).json({
        error: 'A ritual opener needs a ritualDate, and a coach session must not have one',
      } satisfies ErrorResponse);
      return;
    }

    // One session per ritual per day: tapping the card again that day — open or
    // ended — lands back in the same session rather than starting a second one.
    // The unique index is what makes this safe against a double tap; this lookup
    // is what makes the common case return the existing session instead of an error.
    if (ritualDate) {
      const { data: existing, error: findError } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('user_id', req.user!.id)
        .eq('opener', opener)
        .eq('ritual_date', ritualDate)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) {
        const session = existing as DbSession;
        res.json({ session: toSessionDetail(session, await loadSessionMemories(session.id)) });
        return;
      }
    }

    const { data, error } = await supabase
      .from('coaching_sessions')
      .insert({
        user_id: req.user!.id,
        started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
        messages: [],
        opener,
        ritual_date: ritualDate ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ session: toSessionDetail(data as DbSession, []) });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' } satisfies ErrorResponse);
  }
});

// PUT /api/sessions/:id - Update session (messages, name, endedAt)
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { messages, name, endedAt, isProcessed } = req.body as UpdateSessionRequest;

    const updates: Record<string, unknown> = {};
    if (messages !== undefined) updates.messages = messages;
    if (name !== undefined) updates.name = name;
    if (endedAt !== undefined) {
      updates.ended_at = endedAt === null ? null : new Date(endedAt).toISOString();
    }
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
    const {
      generateSummary = true,
      extractMemories: shouldExtract = true,
    } = req.body as FinalizeSessionRequest;

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

    // Open sessions carry a provisional name taken from the first user message;
    // finalize always replaces it with a real summary when asked to.
    if (generateSummary && messages.length > 2) {
      try {
        sessionName = await generateSessionSummary(messages);
      } catch (err) {
        console.error('Failed to generate summary:', err);
      }
    }

    if (!sessionName) {
      const date = new Date(s.started_at);
      sessionName = `Session on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    if (shouldExtract && messages.length > 2) {
      try {
        const { data: existingMemories } = await supabase
          .from('memories')
          .select('content, category')
          .eq('user_id', req.user!.id);

        const { memories: extractedMemories } = await extractMemories(
          messages.map((message) => ({ role: message.role, content: message.content })),
          existingMemories || []
        );

        if (extractedMemories.length > 0) {
          const memoriesData = extractedMemories.map((memory) => ({
            user_id: req.user!.id,
            content: memory.content,
            category: memory.category,
            session_id: id,
            source_session_at: s.started_at,
          }));

          await supabase.from('memories').insert(memoriesData);
        }
      } catch (err) {
        console.error('Failed to extract memories:', err);
      }
    }

    const { error: updateError } = await supabase
      .from('coaching_sessions')
      .update({
        name: sessionName,
        ended_at: new Date().toISOString(),
        is_processed: true,
      })
      .eq('id', id)
      .eq('user_id', req.user!.id);

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
