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
