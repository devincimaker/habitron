import type { Todo, TodoList } from '@habits-coach/shared';

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

import { useTodosStore } from '../stores/useTodosStore';

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
  tags: [],
  createdAt: 1,
  updatedAt: 1,
};

describe('useTodosStore selectors', () => {
  beforeEach(() => {
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
});
