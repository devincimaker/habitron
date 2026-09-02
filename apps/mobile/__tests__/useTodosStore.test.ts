import type { Todo, TodoList, TodoTag } from '@habits-coach/shared';

jest.mock('../services/todos', () => ({
  getTodos: jest.fn(),
  getTodoLists: jest.fn(),
  getTodoTags: jest.fn(),
  addTodo: jest.fn(),
  updateTodo: jest.fn(),
  setTodoStatus: jest.fn(),
  setChecklistItemDone: jest.fn(),
  removeTodo: jest.fn(),
  reorderTodos: jest.fn(),
  createTodoList: jest.fn(),
  updateTodoList: jest.fn(),
  deleteTodoList: jest.fn(),
  createTodoTag: jest.fn(),
}));

import * as todosService from '../services/todos';
import { useTodosStore } from '../stores/useTodosStore';
import { getTodoTagColor } from '../utils/todoTagColors';

const baseList: TodoList = {
  id: 'list-1',
  name: 'Inbox',
  isInbox: true,
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
};

const baseTodo: Todo = {
  id: 'todo-1',
  title: 'Base todo',
  status: 'open',
  position: 0,
  listId: baseList.id,
  createdAt: 1,
  updatedAt: 1,
};

const baseTag: TodoTag = {
  id: 'tag-1',
  name: 'brand',
  color: getTodoTagColor('brand'),
  createdAt: 1,
  updatedAt: 1,
};

describe('useTodosStore selectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTodosStore.setState({
      todos: [],
      lists: [baseList],
      tags: [],
      isLoading: false,
    });
  });

  it('returns only scheduled todos for a selected date', () => {
    useTodosStore.setState({
      todos: [
        {
          ...baseTodo,
          id: 'scheduled-match',
          title: 'Scheduled match',
          scheduledDate: '2026-04-12',
          priority: 2,
        },
        {
          ...baseTodo,
          id: 'due-date-match',
          title: 'Due date match',
          dueDate: '2026-04-12',
          priority: 1,
        },
        {
          ...baseTodo,
          id: 'scheduled-other-day',
          title: 'Scheduled elsewhere',
          scheduledDate: '2026-04-13',
          priority: 1,
        },
      ],
    });

    expect(useTodosStore.getState().getTodosForDate('2026-04-12')).toEqual([
      expect.objectContaining({
        id: 'scheduled-match',
      }),
    ]);
  });

  it('loads in position order, never by time or priority', async () => {
    (todosService.getTodoLists as jest.Mock).mockResolvedValue([baseList]);
    (todosService.getTodoTags as jest.Mock).mockResolvedValue([]);
    (todosService.getTodos as jest.Mock).mockResolvedValue([
        {
          ...baseTodo,
          id: 'later',
          title: 'Later task',
          scheduledDate: '2026-04-12',
          scheduledTime: '13:00',
          priority: 4,
          position: 0,
        },
        {
          ...baseTodo,
          id: 'earlier',
          title: 'Earlier task',
          scheduledDate: '2026-04-12',
          scheduledTime: '09:00',
          priority: 1,
          position: 2,
        },
        {
          ...baseTodo,
          id: 'untimed',
          title: 'Untimed task',
          scheduledDate: '2026-04-12',
          priority: 1,
          position: 1,
        },
    ]);

    await useTodosStore.getState().loadTodos();

    expect(useTodosStore.getState().getTodosForDate('2026-04-12').map((todo) => todo.id)).toEqual([
      'later',
      'untimed',
      'earlier',
    ]);
  });

  it('reorders optimistically and reloads when the write fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const first = { ...baseTodo, id: 'first', position: 0 };
    const second = { ...baseTodo, id: 'second', position: 1 };
    useTodosStore.setState({ todos: [first, second] });

    let rejectReorder!: (error: Error) => void;
    (todosService.reorderTodos as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectReorder = reject;
        })
    );
    (todosService.getTodos as jest.Mock).mockResolvedValue([first, second]);
    (todosService.getTodoLists as jest.Mock).mockResolvedValue([baseList]);
    (todosService.getTodoTags as jest.Mock).mockResolvedValue([]);

    const pending = useTodosStore.getState().reorderTodos([
      { id: 'second', position: 0 },
      { id: 'first', position: 1 },
    ]);

    expect(useTodosStore.getState().todos.map((todo) => [todo.id, todo.position])).toEqual([
      ['second', 0],
      ['first', 1],
    ]);

    rejectReorder(new Error('network failed'));
    await pending;

    expect(todosService.getTodos).toHaveBeenCalled();
    expect(useTodosStore.getState().todos.map((todo) => [todo.id, todo.position])).toEqual([
      ['first', 0],
      ['second', 1],
    ]);
  });

  it('adds a todo optimistically and replaces it when the backend responds', async () => {
    let resolveAddTodo: (todo: Todo) => void = () => undefined;

    (todosService.addTodo as jest.Mock).mockImplementation(
      () =>
        new Promise<Todo>((resolve) => {
          resolveAddTodo = resolve;
        })
    );
    (todosService.getTodoLists as jest.Mock).mockResolvedValue([baseList]);
    (todosService.getTodoTags as jest.Mock).mockResolvedValue([]);

    const pendingAdd = useTodosStore.getState().addTodoOptimistic({
      title: 'Optimistic task',
    });

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        id: expect.stringContaining('optimistic-'),
        title: 'Optimistic task',
        listId: baseList.id,
      }),
    ]);

    resolveAddTodo({
      ...baseTodo,
      id: 'todo-optimistic',
      title: 'Optimistic task',
      position: 10,
      createdAt: 10,
      updatedAt: 10,
    });

    await expect(pendingAdd).resolves.toEqual(
      expect.objectContaining({
        id: 'todo-optimistic',
        title: 'Optimistic task',
      })
    );

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        id: 'todo-optimistic',
        title: 'Optimistic task',
      }),
    ]);
  });

  it('rolls back an optimistic todo if creation fails', async () => {
    (todosService.addTodo as jest.Mock).mockRejectedValue(new Error('network failed'));

    const pendingAdd = useTodosStore.getState().addTodoOptimistic({
      title: 'Broken task',
    });

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        id: expect.stringContaining('optimistic-'),
        title: 'Broken task',
      }),
    ]);

    await expect(pendingAdd).rejects.toThrow('network failed');
    expect(useTodosStore.getState().todos).toEqual([]);
  });

  it('includes the inline category on an optimistic todo before the backend responds', async () => {
    let resolveAddTodo: (todo: Todo) => void = () => undefined;

    useTodosStore.setState({
      tags: [baseTag],
    });

    (todosService.addTodo as jest.Mock).mockImplementation(
      () =>
        new Promise<Todo>((resolve) => {
          resolveAddTodo = resolve;
        })
    );
    (todosService.getTodoLists as jest.Mock).mockResolvedValue([baseList]);
    (todosService.getTodoTags as jest.Mock).mockResolvedValue([
      baseTag,
      {
        id: 'tag-2',
        name: 'girls',
        createdAt: 2,
        updatedAt: 2,
      },
    ]);

    const pendingAdd = useTodosStore.getState().addTodoOptimistic({
      title: 'Optimistic tagged task',
      tagName: 'girls',
    });

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        title: 'Optimistic tagged task',
        tag: expect.objectContaining({
          id: expect.stringContaining('optimistic-tag-'),
          name: 'girls',
          color: getTodoTagColor('girls'),
        }),
      }),
    ]);

    resolveAddTodo({
      ...baseTodo,
      id: 'todo-tagged',
      title: 'Optimistic tagged task',
      tag: {
        id: 'tag-2',
        name: 'girls',
        createdAt: 2,
        updatedAt: 2,
      },
      position: 10,
      createdAt: 10,
      updatedAt: 10,
    });

    await expect(pendingAdd).resolves.toEqual(
      expect.objectContaining({
        id: 'todo-tagged',
        tag: expect.objectContaining({
          id: 'tag-2',
          name: 'girls',
        }),
      })
    );
  });

  it('updates todo status optimistically and reconciles with the backend response', async () => {
    let resolveSetStatus: (todo: Todo) => void = () => undefined;

    useTodosStore.setState({
      todos: [baseTodo],
    });

    (todosService.setTodoStatus as jest.Mock).mockImplementation(
      () =>
        new Promise<Todo>((resolve) => {
          resolveSetStatus = resolve;
        })
    );

    const pendingStatusUpdate = useTodosStore.getState().setTodoStatusOptimistic(
      baseTodo.id,
      'completed'
    );

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        id: baseTodo.id,
        status: 'completed',
        completedAt: expect.any(Number),
      }),
    ]);

    resolveSetStatus({
      ...baseTodo,
      status: 'completed',
      completedAt: 20,
      updatedAt: 20,
    });

    await expect(pendingStatusUpdate).resolves.toEqual(
      expect.objectContaining({
        id: baseTodo.id,
        status: 'completed',
        completedAt: 20,
      })
    );

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        id: baseTodo.id,
        status: 'completed',
        completedAt: 20,
      }),
    ]);
  });

  it('updates a todo optimistically and reconciles with the backend row', async () => {
    let resolveUpdate: (todo: Todo) => void = () => undefined;

    useTodosStore.setState({ todos: [{ ...baseTodo, priority: 3 }] });

    (todosService.updateTodo as jest.Mock).mockImplementation(
      () =>
        new Promise<Todo>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const pendingUpdate = useTodosStore.getState().updateTodo(baseTodo.id, { priority: 1 });

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({ id: baseTodo.id, priority: 1 }),
    ]);

    resolveUpdate({ ...baseTodo, priority: 1, updatedAt: 20 });

    await expect(pendingUpdate).resolves.toEqual(
      expect.objectContaining({ id: baseTodo.id, priority: 1, updatedAt: 20 })
    );
    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({ id: baseTodo.id, priority: 1, updatedAt: 20 }),
    ]);
    // A priority change cannot create a list or tag, so nothing was refetched.
    expect(todosService.getTodoLists).not.toHaveBeenCalled();
    expect(todosService.getTodoTags).not.toHaveBeenCalled();
  });

  it('clears a field optimistically when the key is present with undefined', async () => {
    useTodosStore.setState({ todos: [{ ...baseTodo, priority: 2 }] });
    (todosService.updateTodo as jest.Mock).mockImplementation(
      () => new Promise<Todo>(() => undefined)
    );

    void useTodosStore.getState().updateTodo(baseTodo.id, { priority: undefined });

    expect(useTodosStore.getState().todos[0].priority).toBeUndefined();
  });

  it('rolls back an optimistic update when the write fails', async () => {
    const todoWithPriority: Todo = { ...baseTodo, priority: 4 };
    useTodosStore.setState({ todos: [todoWithPriority] });
    (todosService.updateTodo as jest.Mock).mockRejectedValue(new Error('update failed'));

    const pendingUpdate = useTodosStore.getState().updateTodo(baseTodo.id, { priority: 1 });

    expect(useTodosStore.getState().todos[0].priority).toBe(1);

    await expect(pendingUpdate).rejects.toThrow('update failed');
    expect(useTodosStore.getState().todos).toEqual([todoWithPriority]);
  });

  it('shows a named tag optimistically and refetches metadata only for that save', async () => {
    useTodosStore.setState({ todos: [baseTodo], tags: [baseTag] });

    let resolveUpdate: (todo: Todo) => void = () => undefined;
    (todosService.updateTodo as jest.Mock).mockImplementation(
      () =>
        new Promise<Todo>((resolve) => {
          resolveUpdate = resolve;
        })
    );
    (todosService.getTodoLists as jest.Mock).mockResolvedValue([baseList]);
    (todosService.getTodoTags as jest.Mock).mockResolvedValue([baseTag]);

    const pendingUpdate = useTodosStore.getState().updateTodo(baseTodo.id, { tagName: 'brand' });

    expect(useTodosStore.getState().todos[0].tag).toEqual(baseTag);

    resolveUpdate({ ...baseTodo, tag: baseTag, updatedAt: 20 });
    await pendingUpdate;

    expect(todosService.getTodoTags).toHaveBeenCalled();
    expect(todosService.getTodoLists).toHaveBeenCalled();
  });

  it('rolls back an optimistic status update if the backend request fails', async () => {
    useTodosStore.setState({
      todos: [baseTodo],
    });

    (todosService.setTodoStatus as jest.Mock).mockRejectedValue(new Error('status failed'));

    const pendingStatusUpdate = useTodosStore.getState().setTodoStatusOptimistic(
      baseTodo.id,
      'completed'
    );

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        id: baseTodo.id,
        status: 'completed',
      }),
    ]);

    await expect(pendingStatusUpdate).rejects.toThrow('status failed');
    expect(useTodosStore.getState().todos).toEqual([baseTodo]);
  });

  it('builds optimistic checklist items from quick-create strings', async () => {
    (todosService.addTodo as jest.Mock).mockImplementation(
      () => new Promise<Todo>(() => undefined)
    );

    void useTodosStore.getState().addTodoOptimistic({
      title: 'Groceries',
      checklist: ['milk', ' eggs ', ''],
    });

    expect(useTodosStore.getState().todos).toEqual([
      expect.objectContaining({
        title: 'Groceries',
        checklist: [
          expect.objectContaining({ title: 'milk', done: false, position: 0 }),
          expect.objectContaining({ title: 'eggs', done: false, position: 1 }),
        ],
      }),
    ]);
  });

  it('appends an optimistic todo after its own list, not the global order', async () => {
    const booksList: TodoList = {
      id: 'list-books',
      name: 'Books',
      isInbox: false,
      sortOrder: 1,
      createdAt: 1,
      updatedAt: 1,
    };
    useTodosStore.setState({
      lists: [baseList, booksList],
      todos: [
        { ...baseTodo, id: 'inbox-task', position: 9 },
        { ...baseTodo, id: 'book-task', listId: booksList.id, position: 2 },
      ],
    });
    (todosService.addTodo as jest.Mock).mockImplementation(
      () => new Promise<Todo>(() => undefined)
    );

    void useTodosStore.getState().addTodoOptimistic({
      title: 'Dune',
      listId: booksList.id,
    });

    expect(useTodosStore.getState().todos).toContainEqual(
      expect.objectContaining({ title: 'Dune', listId: booksList.id, position: 3 })
    );
  });

  it('deletes a list through the service and reloads what moved', async () => {
    (todosService.deleteTodoList as jest.Mock).mockResolvedValue(undefined);
    (todosService.getTodos as jest.Mock).mockResolvedValue([baseTodo]);
    (todosService.getTodoLists as jest.Mock).mockResolvedValue([baseList]);
    (todosService.getTodoTags as jest.Mock).mockResolvedValue([]);

    await useTodosStore.getState().deleteTodoList('list-books');

    expect(todosService.deleteTodoList).toHaveBeenCalledWith('list-books');
    expect(todosService.getTodos).toHaveBeenCalled();
    expect(useTodosStore.getState().lists).toEqual([baseList]);
  });

  it('counts open todos per list', () => {
    useTodosStore.setState({
      todos: [
        { ...baseTodo, id: 'a' },
        { ...baseTodo, id: 'b', listId: 'list-books' },
        { ...baseTodo, id: 'c', listId: 'list-books' },
        { ...baseTodo, id: 'd', listId: 'list-books', status: 'completed' },
      ],
    });

    expect(useTodosStore.getState().getOpenTodoCountsByList()).toEqual({
      [baseList.id]: 1,
      'list-books': 2,
    });
  });

  it('ticks a checklist item optimistically and rolls back on failure', async () => {
    const todoWithChecklist: Todo = {
      ...baseTodo,
      checklist: [
        { id: 'item-1', title: 'milk', done: false, position: 0 },
        { id: 'item-2', title: 'eggs', done: false, position: 1 },
      ],
    };

    useTodosStore.setState({ todos: [todoWithChecklist] });

    (todosService.setChecklistItemDone as jest.Mock).mockResolvedValue(undefined);
    await useTodosStore.getState().setChecklistItemDone(baseTodo.id, 'item-1', true);

    expect(useTodosStore.getState().todos[0].checklist).toEqual([
      expect.objectContaining({ id: 'item-1', done: true }),
      expect.objectContaining({ id: 'item-2', done: false }),
    ]);

    (todosService.setChecklistItemDone as jest.Mock).mockRejectedValue(new Error('tick failed'));
    await expect(
      useTodosStore.getState().setChecklistItemDone(baseTodo.id, 'item-2', true)
    ).rejects.toThrow('tick failed');

    expect(useTodosStore.getState().todos[0].checklist).toEqual([
      expect.objectContaining({ id: 'item-1', done: true }),
      expect.objectContaining({ id: 'item-2', done: false }),
    ]);
  });
});
