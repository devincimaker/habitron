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

const INBOX_ROW = { id: 'inbox-1', name: 'Inbox', color: null, is_inbox: true, sort_order: 0 };
const BOOKS_ROW = { id: 'books-1', name: 'Books', color: '#64B5F6', is_inbox: false, sort_order: 1 };

/**
 * Serves `todo_lists` reads from `listRows` and refuses every other table, so
 * a test proves list resolution needs nothing else. The chain is thenable
 * because `listLists` awaits the builder itself.
 */
function listsOnlySupabase(listRows: Record<string, unknown>[]): SupabaseClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve: (result: unknown) => void) => resolve({ data: listRows, error: null }),
  };
  return {
    from: (table: string) => {
      if (table !== 'todo_lists') throw new Error(`supabase.from(${table}) should not be reached`);
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe('resolveListId', () => {
  it('returns undefined without touching the database when no list is named', async () => {
    const db = createDb(unreachableSupabase(), 'user-1');

    await expect(db.resolveListId({})).resolves.toBeUndefined();
  });

  it('passes a known id through and matches a name case-insensitively', async () => {
    const db = createDb(listsOnlySupabase([INBOX_ROW, BOOKS_ROW]), 'user-1');

    await expect(db.resolveListId({ listId: 'books-1' })).resolves.toBe('books-1');
    await expect(db.resolveListId({ listName: 'books' })).resolves.toBe('books-1');
  });

  it('rejects an unknown list and names list_lists', async () => {
    const db = createDb(listsOnlySupabase([INBOX_ROW]), 'user-1');

    await expect(db.resolveListId({ listName: 'Nope' })).rejects.toThrow(/list_lists/);
    await expect(db.resolveListId({ listId: 'ghost' })).rejects.toThrow(/list_lists/);
  });
});

describe('deleteList', () => {
  it('refuses the inbox before touching any task', async () => {
    const db = createDb(listsOnlySupabase([INBOX_ROW, BOOKS_ROW]), 'user-1');

    // A todos access would throw "should not be reached" instead.
    await expect(db.deleteList('inbox-1')).rejects.toThrow(/inbox cannot be deleted/);
  });
});

/**
 * A two-table fake for the task list moves: `todo_lists` reads come from
 * `listRows`, `todos` writes are captured, and each `todos` read pops the next
 * queued response — the order of reads is part of what the test asserts.
 */
function movingSupabase(
  listRows: Record<string, unknown>[],
  todoReads: unknown[]
): { client: SupabaseClient; todoWrites: Record<string, unknown>[] } {
  const todoWrites: Record<string, unknown>[] = [];
  const listsChain: Record<string, unknown> = {
    select: () => listsChain,
    eq: () => listsChain,
    order: () => listsChain,
    maybeSingle: async () => ({ data: listRows.find((row) => row.is_inbox) ?? null, error: null }),
    then: (resolve: (result: unknown) => void) => resolve({ data: listRows, error: null }),
  };
  const todosChain: Record<string, unknown> = {
    select: () => todosChain,
    eq: () => todosChain,
    order: () => todosChain,
    limit: () => todosChain,
    update: (values: Record<string, unknown>) => {
      todoWrites.push(values);
      return todosChain;
    },
    maybeSingle: async () => ({ data: todoReads.shift() ?? null, error: null }),
  };
  return {
    client: {
      from: (table: string) => (table === 'todo_lists' ? listsChain : todosChain),
    } as unknown as SupabaseClient,
    todoWrites,
  };
}

const TASK_ROW = {
  id: 'task-1',
  list_id: 'inbox-1',
  title: 'Dune',
  status: 'open',
  position: 2,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  todo_tags: null,
  todo_checklist_items: [],
};

describe('updateTask list moves', () => {
  it('moving lists writes list_id and appends to the target order', async () => {
    const { client, todoWrites } = movingSupabase(
      [INBOX_ROW, BOOKS_ROW],
      // getTask (current row), nextTaskPosition (target list's last), final update
      [TASK_ROW, { position: 4 }, { ...TASK_ROW, list_id: 'books-1', position: 5 }]
    );

    await createDb(client, 'user-1').updateTask('task-1', { listName: 'Books' });

    expect(todoWrites).toHaveLength(1);
    expect(todoWrites[0].list_id).toBe('books-1');
    expect(todoWrites[0].position).toBe(5);
  });

  it('naming the list the task is already in writes nothing', async () => {
    const { client, todoWrites } = movingSupabase(
      [INBOX_ROW, BOOKS_ROW],
      // getTask (current row), then the empty-update fallback getTask
      [TASK_ROW, TASK_ROW]
    );

    await createDb(client, 'user-1').updateTask('task-1', { listId: 'inbox-1' });

    expect(todoWrites).toHaveLength(0);
  });
});
