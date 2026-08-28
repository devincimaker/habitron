import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDb } from './db.js';

/**
 * createTask's actualMinutes guard runs before anything reaches the database,
 * so a client that throws on any access proves the rejection happens first
 * rather than after a round trip.
 */
function unreachableSupabase(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, property) {
      throw new Error(`supabase.${String(property)} should not be reached`);
    },
  });
}

describe('createTask', () => {
  it('rejects actualMinutes without completedAt, and names set_task_status', async () => {
    const db = createDb(unreachableSupabase(), 'user-1');

    await expect(db.createTask({ title: 'Morning run', actualMinutes: 40 })).rejects.toThrow(
      /set_task_status/
    );
  });

  it('rejects before touching the database at all', async () => {
    const db = createDb(unreachableSupabase(), 'user-1');

    // A supabase access would throw "should not be reached" instead.
    await expect(db.createTask({ title: 'Morning run', actualMinutes: 40 })).rejects.toThrow(
      /needs completedAt/
    );
  });
});

/**
 * Captures the row `setTaskStatus` writes without a database. Every builder
 * method returns the same object, so the chain
 * `.update().eq().eq().select().maybeSingle()` resolves to one recorded update
 * and a row shaped enough for `mapTodo`.
 */
function capturingSupabase(): { client: SupabaseClient; updates: Record<string, unknown>[] } {
  const updates: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {
    update(values: Record<string, unknown>) {
      updates.push(values);
      return chain;
    },
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => ({
      data: {
        id: 'task-1',
        title: 'Dishes',
        status: 'completed',
        todo_tags: null,
        todo_checklist_items: [],
        ...updates[updates.length - 1],
      },
      error: null,
    }),
  };
  return {
    client: { from: () => chain } as unknown as SupabaseClient,
    updates,
  };
}

describe('setTaskStatus', () => {
  it('writes a supplied completedAt verbatim', async () => {
    const { client, updates } = capturingSupabase();

    await createDb(client, 'user-1').setTaskStatus('task-1', 'completed', {
      completedAt: '2026-08-25T05:00:00.000Z',
    });

    expect(updates[0].completed_at).toBe('2026-08-25T05:00:00.000Z');
  });

  it('stamps now when none is supplied', async () => {
    const { client, updates } = capturingSupabase();
    const before = Date.now();

    await createDb(client, 'user-1').setTaskStatus('task-1', 'completed');

    const stamped = Date.parse(updates[0].completed_at as string);
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });

  it('clears the stamp on reopen, and the duration with it', async () => {
    const { client, updates } = capturingSupabase();

    await createDb(client, 'user-1').setTaskStatus('task-1', 'open');

    expect(updates[0].completed_at).toBeNull();
    expect(updates[0].actual_minutes).toBeNull();
  });

  // The stamp is what "completed" means here, so a caller asking to reopen a
  // task *at* a time is describing something the row cannot hold — and the
  // status branch would silently drop it.
  it('refuses a completedAt on any status but completed', async () => {
    const db = createDb(unreachableSupabase(), 'user-1');

    await expect(
      db.setTaskStatus('task-1', 'open', { completedAt: '2026-08-25T05:00:00.000Z' })
    ).rejects.toThrow(/only goes with status 'completed'/);
  });

  it('refuses it before touching the database at all', async () => {
    const db = createDb(unreachableSupabase(), 'user-1');

    // A supabase access would throw "should not be reached" instead.
    await expect(
      db.setTaskStatus('task-1', 'canceled', { completedAt: '2026-08-25T05:00:00.000Z' })
    ).rejects.toThrow(/Reopening or cancelling clears the stamp/);
  });
});
