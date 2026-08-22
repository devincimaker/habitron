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
});
