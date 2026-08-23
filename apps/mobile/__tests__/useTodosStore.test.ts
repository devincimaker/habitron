import type { Todo, TodoList, TodoTag } from '@habits-coach/shared';

jest.mock('../services/todos', () => ({
  getTodos: jest.fn(),
  getTodoLists: jest.fn(),
  getTodoTags: jest.fn(),
  addTodo: jest.fn(),
  updateTodo: jest.fn(),
  setTodoStatus: jest.fn(),
  removeTodo: jest.fn(),
  createTodoList: jest.fn(),
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
  sortOrder: 0,
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

  it('sorts same-day todos by scheduled time before priority', () => {
    useTodosStore.setState({
      todos: [
        {
          ...baseTodo,
          id: 'later',
          title: 'Later task',
          scheduledDate: '2026-04-12',
          scheduledTime: '13:00',
          priority: 1,
        },
        {
          ...baseTodo,
          id: 'earlier',
          title: 'Earlier task',
          scheduledDate: '2026-04-12',
          scheduledTime: '09:00',
          priority: 4,
        },
        {
          ...baseTodo,
          id: 'untimed',
          title: 'Untimed task',
          scheduledDate: '2026-04-12',
          priority: 1,
        },
      ],
    });

    expect(useTodosStore.getState().getTodosForDate('2026-04-12').map((todo) => todo.id)).toEqual([
      'earlier',
      'later',
      'untimed',
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
      sortOrder: 10,
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
      sortOrder: 10,
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
});
