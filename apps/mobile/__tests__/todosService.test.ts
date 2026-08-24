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

import { getTodos, setChecklistItemDone } from '../services/todos';

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

  it('hydrates the todo category from the embedded todo_tags row', async () => {
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
        tag_id: 'tag-1',
        created_at: '2026-04-15T10:00:00.000Z',
        updated_at: '2026-04-15T10:00:00.000Z',
        todo_tags: {
          id: 'tag-1',
          user_id: 'user-1',
          name: 'brand',
          color: '#666666',
          created_at: '2026-04-15T09:00:00.000Z',
          updated_at: '2026-04-15T09:00:00.000Z',
        },
        todo_checklist_items: [
          {
            id: 'item-2',
            user_id: 'user-1',
            todo_id: 'todo-1',
            title: 'eggs',
            done: false,
            position: 1,
            created_at: '2026-04-15T10:00:00.000Z',
            updated_at: '2026-04-15T10:00:00.000Z',
          },
          {
            id: 'item-1',
            user_id: 'user-1',
            todo_id: 'todo-1',
            title: 'milk',
            done: true,
            position: 0,
            created_at: '2026-04-15T10:00:00.000Z',
            updated_at: '2026-04-15T10:00:00.000Z',
          },
        ],
      },
      {
        ...{
          id: 'todo-2',
          user_id: 'user-1',
          goal_id: null,
          list_id: 'list-1',
          title: 'Untagged',
          notes: null,
          status: 'open',
          priority: null,
          due_date: null,
          scheduled_date: null,
          scheduled_time: null,
          estimate_minutes: null,
          completed_at: null,
          canceled_at: null,
          sort_order: 2,
          tag_id: null,
          created_at: '2026-04-15T10:00:00.000Z',
          updated_at: '2026-04-15T10:00:00.000Z',
          todo_tags: null,
          todo_checklist_items: [],
        },
      },
    ];

    const select = jest.fn();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'todos') {
        return {
          select: select.mockReturnValue({
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

      throw new Error(`Unexpected table: ${table}`);
    });

    const todos = await getTodos();

    expect(select).toHaveBeenCalledWith('*, todo_tags(*), todo_checklist_items(*)');
    expect(todos).toEqual([
      expect.objectContaining({
        id: 'todo-1',
        tag: expect.objectContaining({ id: 'tag-1', name: 'brand', color: '#666666' }),
        checklist: [
          { id: 'item-1', title: 'milk', done: true, position: 0 },
          { id: 'item-2', title: 'eggs', done: false, position: 1 },
        ],
      }),
      expect.objectContaining({ id: 'todo-2', tag: undefined, checklist: undefined }),
    ]);
  });

  it('ticks a checklist item', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'todo_checklist_items') {
        return { update };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await setChecklistItemDone('item-1', true);

    expect(update).toHaveBeenCalledWith({ done: true });
    expect(eq).toHaveBeenCalledWith('id', 'item-1');
  });
});
