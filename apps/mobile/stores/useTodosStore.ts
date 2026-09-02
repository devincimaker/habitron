/* eslint-disable max-lines -- HAB-89: split pending */
import { create } from 'zustand';
import type { Todo, TodoDraft, TodoList, TodoStatus, TodoTag } from '@habits-coach/shared';
import { normalizeChecklistDraft } from '@habits-coach/shared';
import * as todosService from '../services/todos';
import type { TodoOrderUpdate, TodoStatusOptions } from '../services/todos';
import { applyTodoOrder, nextTodoPosition, sortTodosByPosition } from '../utils/todoOrder';
import { getTodoTagColor } from '../utils/todoTagColors';
import { resolveNewTodoSchedule } from '../utils/todoTime';

interface TodosState {
  /** Always in `position` order: load and reorder sort, everything else keeps its place or appends. */
  todos: Todo[];
  lists: TodoList[];
  tags: TodoTag[];
  isLoading: boolean;
  loadTodos: () => Promise<void>;
  addTodo: (todo: TodoDraft) => Promise<Todo>;
  addTodoOptimistic: (todo: TodoDraft) => Promise<Todo>;
  updateTodo: (todoId: string, changes: Partial<TodoDraft>) => Promise<Todo>;
  setTodoStatus: (todoId: string, status: TodoStatus, options?: TodoStatusOptions) => Promise<Todo>;
  setTodoStatusOptimistic: (
    todoId: string,
    status: TodoStatus,
    options?: TodoStatusOptions
  ) => Promise<Todo>;
  setChecklistItemDone: (todoId: string, itemId: string, done: boolean) => Promise<void>;
  removeTodo: (todoId: string) => Promise<void>;
  reorderTodos: (updates: TodoOrderUpdate[]) => Promise<void>;
  createTodoList: (name: string, color?: string) => Promise<TodoList>;
  updateTodoList: (listId: string, changes: { name?: string; color?: string }) => Promise<TodoList>;
  deleteTodoList: (listId: string) => Promise<void>;
  createTodoTag: (name: string, color?: string) => Promise<TodoTag>;
  getTodosForDate: (date: string) => Todo[];
  getOverdueTodos: (date: string) => Todo[];
  getOpenTodoCountsByList: () => Record<string, number>;
  clearTodos: () => void;
}

async function reloadMetadata() {
  const [lists, tags] = await Promise.all([
    todosService.getTodoLists(),
    todosService.getTodoTags(),
  ]);

  return { lists, tags };
}

function createOptimisticTodoId() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveOptimisticListId(
  lists: TodoList[],
  draft: TodoDraft
): string {
  if (draft.listId) {
    return draft.listId;
  }

  const normalizedListName = draft.listName?.trim().toLowerCase();
  if (normalizedListName) {
    const matchedList = lists.find(
      (list) => list.name.trim().toLowerCase() === normalizedListName
    );
    if (matchedList) {
      return matchedList.id;
    }
  }

  return lists.find((list) => list.isInbox)?.id ?? lists[0]?.id ?? 'optimistic-inbox';
}

function resolveOptimisticTag(tags: TodoTag[], draft: TodoDraft): TodoTag | undefined {
  if (draft.tagId) {
    return tags.find((tag) => tag.id === draft.tagId);
  }

  const tagName = draft.tagName?.trim();
  if (!tagName) {
    return undefined;
  }

  const existingTag = tags.find(
    (tag) => tag.name.trim().toLowerCase() === tagName.toLowerCase()
  );
  if (existingTag) {
    return existingTag;
  }

  const now = Date.now();
  return {
    id: `optimistic-tag-${now}`,
    name: tagName,
    color: getTodoTagColor(tagName),
    createdAt: now,
    updatedAt: now,
  };
}

function buildOptimisticTodo(state: Pick<TodosState, 'todos' | 'lists' | 'tags'>, draft: TodoDraft): Todo {
  const now = Date.now();
  const schedule = resolveNewTodoSchedule(draft.scheduledDate, draft.scheduledTime);

  if (schedule === null) {
    throw new Error('Invalid scheduled time');
  }

  const listId = resolveOptimisticListId(state.lists, draft);

  return {
    id: createOptimisticTodoId(),
    title: draft.title.trim(),
    notes: draft.notes?.trim() || undefined,
    status: 'open',
    priority: draft.priority,
    dueDate: draft.dueDate,
    scheduledDate: schedule.scheduledDate,
    scheduledTime: schedule.scheduledTime,
    estimateMinutes: draft.estimateMinutes,
    position: nextTodoPosition(state.todos.filter((todo) => todo.listId === listId)),
    listId,
    goalId: draft.goalId,
    tag: resolveOptimisticTag(state.tags, draft),
    checklist: buildOptimisticChecklist(draft),
    createdAt: now,
    updatedAt: now,
  };
}

function buildOptimisticChecklist(draft: TodoDraft): Todo['checklist'] {
  const items = normalizeChecklistDraft(draft.checklist ?? []);
  if (items.length === 0) {
    return undefined;
  }

  return items.map((item, position) => ({
    id: item.id ?? `optimistic-item-${position}`,
    title: item.title,
    done: item.done ?? false,
    position,
  }));
}

function applyChecklistItemDone(todo: Todo, itemId: string, done: boolean): Todo {
  return {
    ...todo,
    checklist: todo.checklist?.map((item) =>
      item.id === itemId ? { ...item, done } : item
    ),
  };
}

function applyOptimisticTodoStatus(
  todo: Todo,
  status: TodoStatus,
  options: TodoStatusOptions
): Todo {
  const now = Date.now();

  return {
    ...todo,
    status,
    completedAt: status === 'completed' ? now : undefined,
    canceledAt: status === 'canceled' ? now : undefined,
    actualMinutes: status === 'completed' ? options.actualMinutes : undefined,
    updatedAt: now,
  };
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
        todos: sortTodosByPosition(todos),
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

  addTodoOptimistic: async (todo) => {
    const optimisticTodo = buildOptimisticTodo(get(), todo);

    set((state) => ({
      todos: [...state.todos, optimisticTodo],
    }));

    try {
      const createdTodo = await todosService.addTodo(todo);
      const metadata = await reloadMetadata();

      set((state) => ({
        todos: state.todos.map((existingTodo) =>
          existingTodo.id === optimisticTodo.id ? createdTodo : existingTodo
        ),
        lists: metadata.lists,
        tags: metadata.tags,
      }));

      return createdTodo;
    } catch (error) {
      set((state) => ({
        todos: state.todos.filter((existingTodo) => existingTodo.id !== optimisticTodo.id),
      }));
      throw error;
    }
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

  setTodoStatus: async (todoId, status, options = {}) => {
    const updatedTodo = await todosService.setTodoStatus(todoId, status, options);
    set((state) => ({
      todos: state.todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)),
    }));
    return updatedTodo;
  },

  setTodoStatusOptimistic: async (todoId, status, options = {}) => {
    const existingTodo = get().todos.find((todo) => todo.id === todoId);

    if (!existingTodo) {
      return get().setTodoStatus(todoId, status, options);
    }

    const optimisticTodo = applyOptimisticTodoStatus(existingTodo, status, options);

    set((state) => ({
      todos: state.todos.map((todo) => (todo.id === todoId ? optimisticTodo : todo)),
    }));

    try {
      const updatedTodo = await todosService.setTodoStatus(todoId, status, options);
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)),
      }));
      return updatedTodo;
    } catch (error) {
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === todoId ? existingTodo : todo)),
      }));
      throw error;
    }
  },

  setChecklistItemDone: async (todoId, itemId, done) => {
    const existingTodo = get().todos.find((todo) => todo.id === todoId);

    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === todoId ? applyChecklistItemDone(todo, itemId, done) : todo
      ),
    }));

    try {
      await todosService.setChecklistItemDone(itemId, done);
    } catch (error) {
      if (existingTodo) {
        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === todoId ? existingTodo : todo)),
        }));
      }
      throw error;
    }
  },

  removeTodo: async (todoId) => {
    await todosService.removeTodo(todoId);
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== todoId),
    }));
  },

  reorderTodos: async (updates) => {
    if (!updates.length) return;
    // Optimistic: the list has already shown the drop, so the order it shows
    // has to survive the round trip rather than wait for it.
    set((state) => ({ todos: sortTodosByPosition(applyTodoOrder(state.todos, updates)) }));

    try {
      await todosService.reorderTodos(updates);
    } catch (error) {
      console.error('Failed to reorder todos:', error);
      await get().loadTodos();
    }
  },

  createTodoList: async (name, color) => {
    const createdList = await todosService.createTodoList(name, color);
    set((state) => ({
      lists: [...state.lists, createdList].sort((a, b) => Number(b.isInbox) - Number(a.isInbox) || a.sortOrder - b.sortOrder),
    }));
    return createdList;
  },

  updateTodoList: async (listId, changes) => {
    const updatedList = await todosService.updateTodoList(listId, changes);
    set((state) => ({
      lists: state.lists.map((list) => (list.id === listId ? updatedList : list)),
    }));
    return updatedList;
  },

  deleteTodoList: async (listId) => {
    await todosService.deleteTodoList(listId);
    // Tasks changed list and position on the server; a reload is the simple truth.
    await get().loadTodos();
  },

  createTodoTag: async (name, color) => {
    const createdTag = await todosService.createTodoTag(name, color);
    set((state) => ({
      tags: [...state.tags, createdTag].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return createdTag;
  },

  getTodosForDate: (date) => {
    return get().todos.filter((todo) => todo.scheduledDate === date);
  },

  getOverdueTodos: (date) => {
    return get()
      .todos
      .filter((todo) => todo.status === 'open' && !!todo.dueDate && todo.dueDate < date)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  },

  getOpenTodoCountsByList: () => {
    const counts: Record<string, number> = {};
    for (const todo of get().todos) {
      if (todo.status !== 'open') continue;
      counts[todo.listId] = (counts[todo.listId] ?? 0) + 1;
    }
    return counts;
  },

  clearTodos: () => {
    set({ todos: [], lists: [], tags: [], isLoading: false });
  },
}));
