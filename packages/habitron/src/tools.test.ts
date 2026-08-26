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
