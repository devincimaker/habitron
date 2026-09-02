import { beforeEach, describe, expect, it, vi } from 'vitest';

const chain = vi.hoisted(() => {
  const stub = {
    insert: vi.fn(() => stub),
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return stub;
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => chain }),
}));

import { createSupabaseInstructActionsDb, type InstructActionRecord } from './instructActions.js';

const ID = 'a4b1c2d3-0000-4000-8000-000000000001';

const EXISTING: InstructActionRecord = {
  id: ID,
  user_id: 'user-1',
  status: 'applied',
  transcript: 'buy the game Juan sent me',
  timezone: 'UTC',
  summary: null,
  result: 'Added it to the Inbox',
  error: null,
  tool_calls: null,
  claude_session_id: null,
  reinstruct_of: null,
  created_at: '2026-09-02T14:56:01Z',
  started_at: '2026-09-02T14:56:01Z',
  finished_at: '2026-09-02T14:56:14Z',
};

const DUPLICATE = { code: '23505', message: 'duplicate key value violates unique constraint' };

const NEW_ROW = { id: ID, user_id: 'user-1', transcript: 'buy the game', timezone: 'UTC', reinstruct_of: null };

describe('createSupabaseInstructActionsDb().insert', () => {
  beforeEach(() => {
    chain.single.mockReset();
    chain.maybeSingle.mockReset();
  });

  it('inserts under the id the client gave it', async () => {
    chain.single.mockResolvedValue({ data: { ...EXISTING, status: 'queued' }, error: null });
    const row = await createSupabaseInstructActionsDb().insert(NEW_ROW);
    expect(chain.insert).toHaveBeenCalledWith(NEW_ROW);
    expect(row.id).toBe(ID);
  });

  it('returns the row already made when the same id arrives twice', async () => {
    // The first upload landed and ran; only its reply was lost.
    chain.single.mockResolvedValue({ data: null, error: DUPLICATE });
    chain.maybeSingle.mockResolvedValue({ data: EXISTING, error: null });

    const row = await createSupabaseInstructActionsDb().insert(NEW_ROW);

    expect(row).toEqual(EXISTING);
    expect(chain.eq).toHaveBeenCalledWith('id', ID);
  });

  it('refuses to hand back another user’s row on a colliding id', async () => {
    chain.single.mockResolvedValue({ data: null, error: DUPLICATE });
    chain.maybeSingle.mockResolvedValue({ data: { ...EXISTING, user_id: 'someone-else' }, error: null });

    await expect(createSupabaseInstructActionsDb().insert(NEW_ROW)).rejects.toThrow('Failed to enqueue instruction');
  });

  it('still throws when the insert fails for any other reason', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });

    await expect(createSupabaseInstructActionsDb().insert(NEW_ROW)).rejects.toThrow('permission denied');
    expect(chain.maybeSingle).not.toHaveBeenCalled();
  });
});
