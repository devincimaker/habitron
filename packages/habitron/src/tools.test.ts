import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTools } from './tools.js';
import type { Db } from './db.js';

/**
 * `Db` is forty-odd methods and a tool handler touches one or two, so the
 * double is a Proxy that throws on anything the test did not stub — an
 * unexpected call fails by name instead of passing as undefined.
 *
 * The cast is unavoidable here: `Partial<Db>` cannot satisfy `createTools`,
 * and the Proxy is what makes the partial safe at runtime.
 */
function stubDb(methods: Partial<Db>): Db {
  return new Proxy({} as Db, {
    get(_target, property) {
      const stubbed = methods[property as keyof Db];
      if (!stubbed) throw new Error(`stubDb: ${String(property)} was not stubbed`);
      return stubbed;
    },
  });
}

function createTaskTool(db: Db, timezone = 'Europe/Paris') {
  const tool = createTools(db, timezone).find((t) => t.name === 'create_task');
  if (!tool) throw new Error('create_task is missing from the tool list');
  return tool;
}

describe('create_task', () => {
  it('converts completedAt from local wall clock to an instant, and passes actualMinutes', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: 'task-1' });
    const tool = createTaskTool(stubDb({ createTask }));

    await tool.handler({
      title: 'Morning run',
      completedAt: '2026-08-25T07:00',
      actualMinutes: 40,
      scheduledDate: '2026-08-25',
      scheduledTime: '07:00',
    });

    expect(createTask).toHaveBeenCalledWith({
      title: 'Morning run',
      // 07:00 in Paris in August is 05:00Z.
      completedAt: '2026-08-25T05:00:00.000Z',
      actualMinutes: 40,
      scheduledDate: '2026-08-25',
      scheduledTime: '07:00',
    });
  });

  it('passes no completedAt at all when none was given', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: 'task-2' });
    const tool = createTaskTool(stubDb({ createTask }));

    await tool.handler({ title: 'Buy oat milk', scheduledDate: '2026-08-26' });

    const [args] = createTask.mock.calls[0];
    expect(args).toEqual({ title: 'Buy oat milk', scheduledDate: '2026-08-26' });
    expect('completedAt' in args).toBe(false);
  });

  it('converts using the tool list’s timezone, not the machine’s', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: 'task-3' });
    const tool = createTaskTool(stubDb({ createTask }), 'America/New_York');

    await tool.handler({ title: 'Standup', completedAt: '2026-08-25T09:30' });

    expect(createTask.mock.calls[0][0].completedAt).toBe('2026-08-25T13:30:00.000Z');
  });

  describe('input schema', () => {
    const schema = () => z.object(createTaskTool(stubDb({})).inputSchema);

    it('rejects a space separator in completedAt', () => {
      const result = schema().safeParse({ title: 'x', completedAt: '2026-08-25 07:15' });
      expect(result.success).toBe(false);
    });

    it('accepts the seconds form a real turn sent, so the log costs one call', () => {
      const result = schema().safeParse({ title: 'x', completedAt: '2026-08-25T07:00:00' });
      expect(result.success).toBe(true);
    });

    it('rejects a zero or negative actualMinutes', () => {
      expect(schema().safeParse({ title: 'x', actualMinutes: 0 }).success).toBe(false);
      expect(schema().safeParse({ title: 'x', actualMinutes: -5 }).success).toBe(false);
    });

    it('accepts a well-formed log', () => {
      const result = schema().safeParse({
        title: 'Morning run',
        completedAt: '2026-08-25T07:00',
        actualMinutes: 40,
      });
      expect(result.success).toBe(true);
    });
  });
});

function setTaskStatusTool(db: Db, timezone = 'Europe/Paris') {
  const tool = createTools(db, timezone).find((t) => t.name === 'set_task_status');
  if (!tool) throw new Error('set_task_status is missing from the tool list');
  return tool;
}

describe('set_task_status', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('converts completedAt from local wall clock to an instant', async () => {
    const setTaskStatus = vi.fn().mockResolvedValue({ id: ID });
    const tool = setTaskStatusTool(stubDb({ setTaskStatus }));

    await tool.handler({ id: ID, status: 'completed', completedAt: '2026-08-25T07:00' });

    expect(setTaskStatus).toHaveBeenCalledWith(ID, 'completed', {
      actualMinutes: undefined,
      completedAt: '2026-08-25T05:00:00.000Z',
    });
  });

  // Absent, not null: db.ts falls back to now on `undefined`, and sending the
  // key with nothing in it would be a caller claiming a time it does not have.
  it('passes no completedAt at all when none was given', async () => {
    const setTaskStatus = vi.fn().mockResolvedValue({ id: ID });
    const tool = setTaskStatusTool(stubDb({ setTaskStatus }));

    await tool.handler({ id: ID, status: 'completed', actualMinutes: 25 });

    const change = setTaskStatus.mock.calls[0][2];
    expect('completedAt' in change).toBe(false);
    expect(change.actualMinutes).toBe(25);
  });

  it('converts using the tool list\u2019s timezone, not the machine\u2019s', async () => {
    const setTaskStatus = vi.fn().mockResolvedValue({ id: ID });
    const tool = setTaskStatusTool(stubDb({ setTaskStatus }), 'America/New_York');

    await tool.handler({ id: ID, status: 'completed', completedAt: '2026-08-25T09:30' });

    expect(setTaskStatus.mock.calls[0][2].completedAt).toBe('2026-08-25T13:30:00.000Z');
  });

  describe('input schema', () => {
    const schema = () => z.object(setTaskStatusTool(stubDb({})).inputSchema);

    it('rejects a space separator in completedAt', () => {
      const result = schema().safeParse({ id: ID, status: 'completed', completedAt: '2026-08-25 07:15' });
      expect(result.success).toBe(false);
    });

    it('accepts a completion with a time and a duration', () => {
      const result = schema().safeParse({
        id: ID,
        status: 'completed',
        completedAt: '2026-08-25T07:00',
        actualMinutes: 40,
      });
      expect(result.success).toBe(true);
    });
  });
});

function findTool(name: string, db: Db) {
  const tool = createTools(db, 'Europe/Paris').find((t) => t.name === name);
  if (!tool) throw new Error(`${name} is missing from the tool list`);
  return tool;
}

describe('lists on the task tools', () => {
  const LIST_ID = '22222222-2222-4222-8222-222222222222';

  it('create_task passes listId and listName through', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: 'task-1' });
    const tool = findTool('create_task', stubDb({ createTask }));

    await tool.handler({ title: 'Dune', listName: 'Books' });

    expect(createTask).toHaveBeenCalledWith({ title: 'Dune', listName: 'Books' });
  });

  it('create_task rejects an empty listName', () => {
    const schema = z.object(findTool('create_task', stubDb({})).inputSchema);
    expect(schema.safeParse({ title: 'x', listName: '' }).success).toBe(false);
    expect(schema.safeParse({ title: 'x', listId: 'not-a-uuid' }).success).toBe(false);
  });

  it('list_tasks filters to the resolved list', async () => {
    const resolveListId = vi.fn().mockResolvedValue(LIST_ID);
    const listAllTasks = vi.fn().mockResolvedValue([
      { id: 't1', title: 'Dune', status: 'open', listId: LIST_ID },
      { id: 't2', title: 'Dishes', status: 'open', listId: 'other-list' },
    ]);
    const tool = findTool('list_tasks', stubDb({ resolveListId, listAllTasks } as Partial<Db>));

    const result = (await tool.handler({ listName: 'Books' })) as {
      tasks: Array<{ id: string }>;
      total: number;
    };

    expect(resolveListId).toHaveBeenCalledWith({ listName: 'Books' });
    expect(result.tasks.map((t) => t.id)).toEqual(['t1']);
    expect(result.total).toBe(1);
  });

  it('delete_list returns the db result verbatim and rejects a non-uuid id', async () => {
    const outcome = { deleted: { id: LIST_ID }, tasksMoved: 3, movedTo: { id: 'inbox' } };
    const deleteList = vi.fn().mockResolvedValue(outcome);
    const tool = findTool('delete_list', stubDb({ deleteList } as Partial<Db>));

    await expect(tool.handler({ id: LIST_ID })).resolves.toBe(outcome);
    expect(z.object(tool.inputSchema).safeParse({ id: 'books' }).success).toBe(false);
  });
});
