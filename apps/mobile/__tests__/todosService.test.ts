const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

import { addTodo, getTodos } from '../services/todos';

describe('todos service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
    });
  });

  it('hydrates todo tags when todo_tag_assignments embeds todo_tags as a single object', async () => {
    const mockTodoRows = [
      {
        id: 'todo-1',
        user_id: 'user-1',
        goal_id: null,
        list_id: 'list-1',
        title: 'Write launch copy',
        notes: null,
        status: 'open',
        priority: null,
        due_date: null,
        scheduled_date: null,
        scheduled_time: null,
        estimate_minutes: null,
        completed_at: null,
        canceled_at: null,
        sort_order: 1,
        created_at: '2026-04-15T10:00:00.000Z',
        updated_at: '2026-04-15T10:00:00.000Z',
      },
    ];

    const tagAssignmentIn = jest.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'todos') {
        return {
          select: () => ({
            order: () => ({
              order: () => ({
                order: () => ({
                  order: () =>
                    Promise.resolve({
                      data: mockTodoRows,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'todo_tag_assignments') {
        return {
          select: () => ({
            in: tagAssignmentIn.mockResolvedValue({
              data: [
                {
                  todo_id: 'todo-1',
                  tag_id: 'tag-1',
                  todo_tags: {
                    id: 'tag-1',
                    user_id: 'user-1',
                    name: 'brand',
                    color: '#666666',
                    created_at: '2026-04-15T09:00:00.000Z',
                    updated_at: '2026-04-15T09:00:00.000Z',
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const todos = await getTodos();

    expect(todos).toEqual([
      expect.objectContaining({
        id: 'todo-1',
        title: 'Write launch copy',
        tags: [
          expect.objectContaining({
            id: 'tag-1',
            name: 'brand',
          }),
        ],
      }),
    ]);
    expect(tagAssignmentIn).toHaveBeenCalledWith('todo_id', ['todo-1']);
  });

  it('falls back to scheduled_block when scheduled_time is missing from the schema cache', async () => {
    const insertCalls: Array<Record<string, unknown>> = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'todos') {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertCalls.push(payload);

            if (insertCalls.length === 1) {
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: {
                        code: 'PGRST204',
                        message: "Could not find the 'scheduled_time' column of 'todos' in the schema cache",
                      },
                    }),
                }),
              };
            }

            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'todo-legacy',
                      user_id: 'user-1',
                      goal_id: null,
                      list_id: 'list-1',
                      title: 'Legacy schema todo',
                      notes: null,
                      status: 'open',
                      priority: null,
                      due_date: null,
                      scheduled_date: '2026-04-21',
                      scheduled_block: 'morning',
                      estimate_minutes: null,
                      completed_at: null,
                      canceled_at: null,
                      sort_order: 123,
                      created_at: '2026-04-21T10:00:00.000Z',
                      updated_at: '2026-04-21T10:00:00.000Z',
                    },
                    error: null,
                  }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'todo-legacy',
                    user_id: 'user-1',
                    goal_id: null,
                    list_id: 'list-1',
                    title: 'Legacy schema todo',
                    notes: null,
                    status: 'open',
                    priority: null,
                    due_date: null,
                    scheduled_date: '2026-04-21',
                    scheduled_block: 'morning',
                    estimate_minutes: null,
                    completed_at: null,
                    canceled_at: null,
                    sort_order: 123,
                    created_at: '2026-04-21T10:00:00.000Z',
                    updated_at: '2026-04-21T10:00:00.000Z',
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === 'todo_tag_assignments') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const todo = await addTodo({
      title: 'Legacy schema todo',
      listId: 'list-1',
      scheduledDate: '2026-04-21',
      scheduledTime: '09:30',
    });

    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0]).toEqual(
      expect.objectContaining({
        scheduled_time: '09:30',
      })
    );
    expect(insertCalls[1]).toEqual(
      expect.objectContaining({
        scheduled_block: 'morning',
      })
    );
    expect(todo).toEqual(
      expect.objectContaining({
        id: 'todo-legacy',
        scheduledDate: '2026-04-21',
        scheduledTime: '09:00',
      })
    );
  });
});
