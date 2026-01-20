import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { extractMemories } from '../services/memories.js';
import { getSupabaseClient } from '../services/supabase.js';
import type { ExtractMemoriesRequest, ErrorResponse, MemoryCategory } from '@habits-coach/shared';

const router: Router = Router();

// GET /api/memories - Get all memories for user
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ memories: data });
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({ error: 'Failed to fetch memories' } satisfies ErrorResponse);
  }
});

// POST /api/memories/extract - Extract memories from conversation (does NOT save)
router.post('/extract', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages } = req.body as ExtractMemoriesRequest;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required' } satisfies ErrorResponse);
      return;
    }

    const supabase = getSupabaseClient();

    // Fetch existing memories for deduplication
    const { data: existingMemories } = await supabase
      .from('memories')
      .select('content, category')
      .eq('user_id', req.user!.id);

    // Extract memories using AI (return without saving)
    const extracted = await extractMemories(messages, existingMemories || []);
    res.json(extracted);
  } catch (error) {
    console.error('Extract memories error:', error);
    res.status(500).json({ error: 'Failed to extract memories' } satisfies ErrorResponse);
  }
});

// POST /api/memories - Save approved memories
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memories, sessionId } = req.body as {
      memories: Array<{ content: string; category: MemoryCategory }>;
      sessionId?: string;
    };

    if (!Array.isArray(memories) || memories.length === 0) {
      res.status(400).json({ error: 'Memories array is required' } satisfies ErrorResponse);
      return;
    }

    const supabase = getSupabaseClient();

    const memoriesData = memories.map((m) => ({
      user_id: req.user!.id,
      content: m.content,
      category: m.category,
      session_id: sessionId || null,
      source_session_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase.from('memories').insert(memoriesData).select();
    if (error) throw error;

    res.json({ memories: data });
  } catch (error) {
    console.error('Save memories error:', error);
    res.status(500).json({ error: 'Failed to save memories' } satisfies ErrorResponse);
  }
});

// PUT /api/memories/:id - Update a memory
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content, category } = req.body as { content?: string; category?: MemoryCategory };

    const supabase = getSupabaseClient();

    const updates: { content?: string; category?: MemoryCategory } = {};
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;

    const { data, error } = await supabase
      .from('memories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Memory not found' } satisfies ErrorResponse);
      return;
    }

    res.json({ memory: data });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ error: 'Failed to update memory' } satisfies ErrorResponse);
  }
});

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Failed to delete memory' } satisfies ErrorResponse);
  }
});

export default router;
