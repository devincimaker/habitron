import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEq = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('../config.js', () => ({
  config: {
    supabase: {
      url: 'https://example.supabase.co',
      serviceRoleKey: 'test-service-role-key',
    },
  },
}));

import {
  getCoachTaskOverview,
  resolveCoachTaskMap,
} from './coachTaskTools.js';

describe('coachTaskTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
  });

  it('prefers database tasks over an empty client snapshot when userId is available', async () => {
    mockEq.mockReturnValue({
      data: [
        {
          id: 'db-task-1',
          user_id: 'user-123',
          goal_id: null,
          list_id: 'list-1',
          title: 'Backend task',
          notes: null,
          status: 'open',
          priority: 2,
          due_date: '2026-04-24',
          scheduled_date: '2026-04-23',
          scheduled_time: '09:00',
          estimate_minutes: 30,
          completed_at: null,
          canceled_at: null,
          sort_order: 1,
          created_at: '2026-04-22T12:00:00.000Z',
          updated_at: '2026-04-22T12:00:00.000Z',
        },
      ],
      error: null,
    });

    const overview = await getCoachTaskOverview({
      userId: 'user-123',
      todos: [],
      today: '2026-04-23',
    });

    expect(mockFrom).toHaveBeenCalledWith('todos');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(overview.totalTasks).toBe(1);
    expect(overview.sampleOpenTasks).toEqual([
      expect.objectContaining({
        id: 'db-task-1',
        title: 'Backend task',
      }),
    ]);
  });

  it('uses database tasks to ground referenced todo ids when userId is available', async () => {
    mockEq.mockReturnValue({
      data: [
        {
          id: 'db-task-2',
          user_id: 'user-123',
          goal_id: null,
          list_id: 'list-1',
          title: 'Call the client',
          notes: null,
          status: 'open',
          priority: 1,
          due_date: null,
          scheduled_date: null,
          scheduled_time: null,
          estimate_minutes: null,
          completed_at: null,
          canceled_at: null,
          sort_order: 1,
          created_at: '2026-04-22T12:00:00.000Z',
          updated_at: '2026-04-22T12:00:00.000Z',
        },
      ],
      error: null,
    });

    const taskMap = await resolveCoachTaskMap({
      userId: 'user-123',
      todos: [],
      ids: ['db-task-2'],
    });

    expect(taskMap.get('db-task-2')).toEqual(
      expect.objectContaining({
        id: 'db-task-2',
        title: 'Call the client',
      })
    );
  });
});
