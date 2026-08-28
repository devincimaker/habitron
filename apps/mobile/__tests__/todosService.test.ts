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

import { getTodos, setChecklistItemDone, updateTodo } from '../services/todos';

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
        position: 1,
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
          position: 2,
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
            order: () =>
              Promise.resolve({
                data: mockTodoRows,
                error: null,
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

  // Every clearable field is sent as `undefined`; reading the value instead of
  // the key made "no priority" and "no estimate" silently do nothing.
  it.each([
    ['priority', { priority: undefined }, { priority: null }],
    ['estimate', { estimateMinutes: undefined }, { estimate_minutes: null }],
    ['due date', { dueDate: undefined }, { due_date: null }],
    ['notes', { notes: undefined }, { notes: null }],
  ])('clears the %s when the key is present with no value', async (_label, changes, expected) => {
    const update = captureTodoUpdate();

    await updateTodo('todo-1', changes);

    expect(update).toHaveBeenCalledWith(expected);
  });

  it('leaves a field alone when its key is absent', async () => {
    const update = captureTodoUpdate();

    await updateTodo('todo-1', { title: 'Renamed' });

    expect(update).toHaveBeenCalledWith({ title: 'Renamed' });
  });

  // PostgREST answers PGRST102 "All object keys must match" when one bulk write
  // mixes rows carrying an id with rows that do not — which is every checklist
  // that gains an item while keeping the ones already there.
  it('writes existing and new checklist items in separate calls', async () => {
    const { upsert, insert } = captureChecklistWrite([{ id: 'item-1' }]);

    await updateTodo('todo-1', {
      checklist: [
        { id: 'item-1', title: 'oat milk', done: true },
        { title: 'bananas' },
      ],
    });

    expect(upsert).toHaveBeenCalledWith([
      {
        id: 'item-1',
        user_id: 'user-1',
        todo_id: 'todo-1',
        title: 'oat milk',
        done: true,
        position: 0,
      },
    ]);
    expect(insert).toHaveBeenCalledWith([
      { user_id: 'user-1', todo_id: 'todo-1', title: 'bananas', done: false, position: 1 },
    ]);
  });

  it('skips the insert when every checklist item already exists', async () => {
    const { upsert, insert } = captureChecklistWrite([{ id: 'item-1' }]);

    await updateTodo('todo-1', { checklist: [{ id: 'item-1', title: 'oat milk', done: false }] });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });
});

/** Mocks a checklist sync over `existingRows`, and hands back its two write spies. */
function captureChecklistWrite(existingRows: Array<{ id: string }>) {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const insert = jest.fn().mockResolvedValue({ error: null });
  const single = jest.fn().mockResolvedValue({
    data: {
      id: 'todo-1',
      title: 'Buy oat milk',
      status: 'open',
      position: 0,
      list_id: 'list-1',
      todo_checklist_items: [],
    },
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'todo_checklist_items') {
      return {
        select: () => ({ eq: jest.fn().mockResolvedValue({ data: existingRows, error: null }) }),
        delete: () => ({ in: jest.fn().mockResolvedValue({ error: null }) }),
        upsert,
        insert,
      };
    }
    if (table === 'todos') {
      return {
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
        select: () => ({ eq: () => ({ single }) }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { upsert, insert };
}

/** Mocks the update-then-refetch pair, and hands back the update spy. */
function captureTodoUpdate() {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  const single = jest.fn().mockResolvedValue({
    data: {
      id: 'todo-1',
      title: 'Buy oat milk',
      status: 'open',
      position: 0,
      list_id: 'list-1',
      todo_checklist_items: [],
    },
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table !== 'todos') throw new Error(`Unexpected table: ${table}`);
    return {
      update,
      select: () => ({ eq: () => ({ single }) }),
    };
  });

  return update;
}
