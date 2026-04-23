import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { generateSessionSummary } from '../services/sessions.js';
import { extractMemories } from '../services/memories.js';
import {
  listCoachDebugEvents,
  logCoachDebugEvent,
  sessionBelongsToUser,
} from '../services/coachDebugEvents.js';
import { isCoachSkillId } from '../coach/registry.js';
import {
  getSessionSkillInstances,
  updateSessionSkillInstance,
} from '../coach/runtime.js';
import type {
  CoachSkillId,
  CreateCoachDebugEventRequest,
  CreateCoachDebugEventResponse,
  CoachingSessionMessage,
  CoachingSessionSummary,
  CreateSessionRequest,
  UpdateSessionRequest,
  FinalizeSessionRequest,
  ErrorResponse,
  GetCoachDebugEventsResponse,
  MemoryCategory,
  UpdateSessionSkillRequest,
} from '@habits-coach/shared';

const router: Router = Router();
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

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

interface DbSkillSummary {
  session_id: string;
  skill_id: CoachSkillId;
  status: 'active' | 'paused' | 'completed';
  is_lead: boolean;
}

function getLeadSkillId(
  skills: DbSkillSummary[]
): CoachSkillId | null {
  const lead = skills.find((skill) => skill.is_lead && skill.status === 'active');
  if (lead) {
    return lead.skill_id;
  }

  const fallback = skills.find((skill) => skill.status === 'active');
  return fallback?.skill_id ?? null;
}

async function ensureSessionOwnership(
  sessionId: string,
  userId: string,
  res: Response
): Promise<boolean> {
  const belongsToUser = await sessionBelongsToUser(sessionId, userId);
  if (belongsToUser) {
    return true;
  }

  res.status(404).json({ error: 'Session not found' } satisfies ErrorResponse);
  return false;
}

// GET /api/sessions - List sessions (last 50)
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: sessions, error } = await supabase
      .from('coaching_sessions')
      .select('id, name, messages, started_at, ended_at')
      .eq('user_id', req.user!.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const sessionRows = (sessions ?? []) as Pick<
      DbSession,
      'id' | 'name' | 'messages' | 'started_at' | 'ended_at'
    >[];
    const sessionIds = sessionRows.map((session) => session.id);

    let memoryCountMap = new Map<string, number>();
    let leadSkillMap = new Map<string, CoachSkillId | null>();

    if (sessionIds.length > 0) {
      const [{ data: memoryCounts, error: countError }, { data: skillRows, error: skillError }] =
        await Promise.all([
          supabase.from('memories').select('session_id').in('session_id', sessionIds),
          supabase
            .from('coaching_skill_instances')
            .select('session_id, skill_id, status, is_lead')
            .eq('user_id', req.user!.id)
            .in('session_id', sessionIds),
        ]);

      if (countError) throw countError;
      if (skillError) throw skillError;

      memoryCountMap = (memoryCounts || []).reduce((map, memory) => {
        const sessionId = memory.session_id as string | null;
        if (sessionId) {
          map.set(sessionId, (map.get(sessionId) || 0) + 1);
        }
        return map;
      }, new Map<string, number>());

      const skillsBySession = ((skillRows ?? []) as DbSkillSummary[]).reduce((map, skill) => {
        const sessionSkills = map.get(skill.session_id) ?? [];
        sessionSkills.push(skill);
        map.set(skill.session_id, sessionSkills);
        return map;
      }, new Map<string, DbSkillSummary[]>());

      leadSkillMap = new Map(
        Array.from(skillsBySession.entries()).map(([sessionId, sessionSkills]) => [
          sessionId,
          getLeadSkillId(sessionSkills),
        ])
      );
    }

    const result: CoachingSessionSummary[] = sessionRows.map((session) => ({
      id: session.id,
      name: session.name,
      startedAt: new Date(session.started_at).getTime(),
      endedAt: session.ended_at ? new Date(session.ended_at).getTime() : null,
      messageCount: session.messages?.length || 0,
      memoryCount: memoryCountMap.get(session.id) || 0,
      leadSkillId: leadSkillMap.get(session.id) ?? null,
    }));

    res.json({ sessions: result });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' } satisfies ErrorResponse);
  }
});

// GET /api/sessions/active - Get active session if exists
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

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      res.json({ session: null });
      return;
    }

    const session = data as DbSession;
    const skills = await getSessionSkillInstances(session.id, req.user!.id);
    const leadSkill = skills.find((skill) => skill.isLead) ?? skills[0] ?? null;

    res.json({
      session: {
        id: session.id,
        name: session.name,
        startedAt: new Date(session.started_at).getTime(),
        endedAt: null,
        messageCount: session.messages?.length || 0,
        messages: session.messages || [],
        updatedAt: new Date(session.updated_at).getTime(),
        leadSkillId: leadSkill?.skillId ?? null,
      },
    });
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Failed to fetch active session' } satisfies ErrorResponse);
  }
});

// GET /api/sessions/:id/debug-events - List session debug events
router.get('/:id/debug-events', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!(await ensureSessionOwnership(id, req.user!.id, res))) {
      return;
    }

    const events = await listCoachDebugEvents(id, req.user!.id);
    res.json({ events } satisfies GetCoachDebugEventsResponse);
  } catch (error) {
    console.error('Get session debug events error:', error);
    res.status(500).json({ error: 'Failed to fetch session debug events' } satisfies ErrorResponse);
  }
});

// POST /api/sessions/:id/debug-events - Create a session debug event
router.post('/:id/debug-events', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { event } = req.body as CreateCoachDebugEventRequest;

    if (!(await ensureSessionOwnership(id, req.user!.id, res))) {
      return;
    }

    if (!event || typeof event.eventType !== 'string') {
      res.status(400).json({ error: 'Invalid request: eventType is required' } satisfies ErrorResponse);
      return;
    }

    const createdEvent = await logCoachDebugEvent({
      sessionId: id,
      userId: req.user!.id,
      event,
    });

    res.json({ event: createdEvent } satisfies CreateCoachDebugEventResponse);
  } catch (error) {
    console.error('Create session debug event error:', error);
    res.status(500).json({ error: 'Failed to create session debug event' } satisfies ErrorResponse);
  }
});

// GET /api/sessions/:id - Get session detail with memories and active skills
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

    const [{ data: memories, error: memError }, activeSkills] = await Promise.all([
      supabase
        .from('memories')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true }),
      getSessionSkillInstances(id, req.user!.id),
    ]);

    if (memError) throw memError;

    const s = session as DbSession;
    const leadSkill = activeSkills.find((skill) => skill.isLead) ?? activeSkills[0] ?? null;

    res.json({
      session: {
        id: s.id,
        name: s.name,
        startedAt: new Date(s.started_at).getTime(),
        endedAt: s.ended_at ? new Date(s.ended_at).getTime() : null,
        messageCount: s.messages?.length || 0,
        messages: s.messages || [],
        memories: ((memories ?? []) as DbMemory[]).map((memory) => ({
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
        activeSkills,
        leadSkillId: leadSkill?.skillId ?? null,
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

// PUT /api/sessions/:id - Update session (messages, name, endedAt)
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

// PUT /api/sessions/:id/skills/:skillId - Update session skill instance
router.put('/:id/skills/:skillId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, skillId } = req.params;

    if (!(await ensureSessionOwnership(id, req.user!.id, res))) {
      return;
    }

    if (!isCoachSkillId(skillId)) {
      res.status(400).json({ error: 'Invalid coach skill id' } satisfies ErrorResponse);
      return;
    }

    const skill = await updateSessionSkillInstance({
      sessionId: id,
      userId: req.user!.id,
      skillId,
      updates: req.body as UpdateSessionSkillRequest,
    });

    res.json({ skill });
  } catch (error) {
    console.error('Update session skill error:', error);
    res.status(500).json({ error: 'Failed to update session skill' } satisfies ErrorResponse);
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

    if (!sessionName && generateSummary && messages.length > 2) {
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

// DELETE /api/sessions/:id - Delete session (cascades to memories and skill instances)
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
