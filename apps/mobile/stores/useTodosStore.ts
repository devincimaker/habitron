import { create } from 'zustand';
import type { Todo, TodoDraft, TodoList, TodoStatus, TodoTag } from '@habits-coach/shared';
import * as todosService from '../services/todos';

interface TodosState {
  todos: Todo[];
  lists: TodoList[];
  tags: TodoTag[];
  isLoading: boolean;
  loadTodos: () => Promise<void>;
  addTodo: (todo: TodoDraft) => Promise<Todo>;
  updateTodo: (todoId: string, changes: Partial<TodoDraft>) => Promise<Todo>;
  setTodoStatus: (todoId: string, status: TodoStatus) => Promise<Todo>;
  removeTodo: (todoId: string) => Promise<void>;
  createTodoList: (name: string, color?: string) => Promise<TodoList>;
  createTodoTag: (name: string, color?: string) => Promise<TodoTag>;
  getTodosForDate: (date: string) => Todo[];
  getOverdueTodos: (date: string) => Todo[];
  getInboxTodos: () => Todo[];
  clearTodos: () => void;
}

async function reloadMetadata() {
  const [lists, tags] = await Promise.all([
    todosService.getTodoLists(),
    todosService.getTodoTags(),
  ]);

  return { lists, tags };
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  lists: [],
  tags: [],
  isLoading: false,

  loadTodos: async () => {
    set({ isLoading: true });
    try {
      const [todos, metadata] = await Promise.all([
        todosService.getTodos(),
        reloadMetadata(),
      ]);

      set({
        todos,
        lists: metadata.lists,
        tags: metadata.tags,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load todos:', error);
      set({ isLoading: false });
    }
  },

  addTodo: async (todo) => {
    const createdTodo = await todosService.addTodo(todo);
    const metadata = await reloadMetadata();
    set((state) => ({
      todos: [...state.todos, createdTodo],
      lists: metadata.lists,
      tags: metadata.tags,
    }));
    return createdTodo;
  },

  updateTodo: async (todoId, changes) => {
    const updatedTodo = await todosService.updateTodo(todoId, changes);
    const metadata = await reloadMetadata();
    set((state) => ({
      todos: state.todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)),
      lists: metadata.lists,
      tags: metadata.tags,
    }));
    return updatedTodo;
  },

  setTodoStatus: async (todoId, status) => {
    const updatedTodo = await todosService.setTodoStatus(todoId, status);
    set((state) => ({
      todos: state.todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)),
    }));
    return updatedTodo;
  },

  removeTodo: async (todoId) => {
    await todosService.removeTodo(todoId);
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== todoId),
    }));
  },

  createTodoList: async (name, color) => {
    const createdList = await todosService.createTodoList(name, color);
    set((state) => ({
      lists: [...state.lists, createdList].sort((a, b) => Number(b.isInbox) - Number(a.isInbox) || a.sortOrder - b.sortOrder),
    }));
    return createdList;
  },

  createTodoTag: async (name, color) => {
    const createdTag = await todosService.createTodoTag(name, color);
    set((state) => ({
      tags: [...state.tags, createdTag].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return createdTag;
  },

  getTodosForDate: (date) => {
    return get()
      .todos
      .filter((todo) => todo.scheduledDate === date)
      .sort((a, b) => {
        const priorityA = a.priority ?? 5;
        const priorityB = b.priority ?? 5;
        return priorityA - priorityB || a.sortOrder - b.sortOrder;
      });
  },

  getOverdueTodos: (date) => {
    return get()
      .todos
      .filter((todo) => todo.status === 'open' && !!todo.dueDate && todo.dueDate < date)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  },

  getInboxTodos: () => {
    const inboxId = get().lists.find((list) => list.isInbox)?.id;
    if (!inboxId) return [];

    return get().todos.filter(
      (todo) => todo.listId === inboxId && todo.status === 'open' && !todo.scheduledDate
    );
  },

  clearTodos: () => {
    set({ todos: [], lists: [], tags: [], isLoading: false });
  },
}));
