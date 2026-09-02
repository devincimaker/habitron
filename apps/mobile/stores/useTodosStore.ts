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
  /**
   * Every write is optimistic: the change shows immediately, the server row
   * replaces it, a failure rolls it back and rejects so the caller can say so.
   */
  addTodo: (todo: TodoDraft) => Promise<Todo>;
  updateTodo: (todoId: string, changes: Partial<TodoDraft>) => Promise<Todo>;
  setTodoStatus: (todoId: string, status: TodoStatus, options?: TodoStatusOptions) => Promise<Todo>;
  setChecklistItemDone: (todoId: string, itemId: string, done: boolean) => Promise<void>;
  reorderTodos: (updates: TodoOrderUpdate[]) => Promise<void>;
  createTodoList: (name: string, color?: string) => Promise<TodoList>;
  updateTodoList: (listId: string, changes: { name?: string; color?: string }) => Promise<TodoList>;
  /** Its tasks move to the Inbox, appended in their old order — the same shape the server writes. */
  deleteTodoList: (listId: string) => Promise<void>;
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

/**
 * A write can only grow the cached lists/tags when it names one — everything
 * else (priority, dates, title…) leaves the metadata untouched and can skip
 * the two refetches.
 */
function changesCanCreateMetadata(changes: Partial<TodoDraft>): boolean {
  return Boolean(changes.listName?.trim()) || Boolean(changes.tagName?.trim());
}

function sortLists(lists: TodoList[]): TodoList[] {
  return [...lists].sort(
    (a, b) => Number(b.isInbox) - Number(a.isInbox) || a.sortOrder - b.sortOrder
  );
}

/** The doomed list's tasks append to the target in their old relative order. */
function moveTodosToList(todos: Todo[], fromListId: string, toListId: string): Todo[] {
  let position = nextTodoPosition(todos.filter((todo) => todo.listId === toListId));
  return todos.map((todo) =>
    todo.listId === fromListId ? { ...todo, listId: toListId, position: position++ } : todo
  );
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

function resolveOptimisticTag(
  tags: TodoTag[],
  draft: Pick<TodoDraft, 'tagId' | 'tagName'>
): TodoTag | undefined {
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
    checklist: buildOptimisticChecklist(draft.checklist),
    createdAt: now,
    updatedAt: now,
  };
}

function buildOptimisticChecklist(checklist: TodoDraft['checklist']): Todo['checklist'] {
  const items = normalizeChecklistDraft(checklist ?? []);
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

/** The update's three-state tag semantics: absent keeps, empty clears, a name finds or mints. */
function resolveOptimisticTagChange(
  todo: Todo,
  changes: Partial<TodoDraft>,
  tags: TodoTag[]
): TodoTag | undefined {
  if (changes.tagId !== undefined) {
    if (changes.tagId === null) {
      return undefined;
    }
    return tags.find((tag) => tag.id === changes.tagId) ?? todo.tag;
  }

  if (changes.tagName === undefined) {
    return todo.tag;
  }

  if (!changes.tagName?.trim()) {
    return undefined;
  }

  return resolveOptimisticTag(tags, { tagName: changes.tagName });
}

/**
 * Predicts the row `todosService.updateTodo` will return, so the UI can show
 * an edit before the round trip. Mirrors the service's key-presence semantics
 * (`{ priority: undefined }` clears). What it cannot predict it leaves for the
 * server row to correct: a list move's new position, a `listName`-only move.
 * Returns null when the schedule is invalid — the write stays pessimistic and
 * the server rejects it.
 */
function applyOptimisticTodoChanges(
  todo: Todo,
  changes: Partial<TodoDraft>,
  tags: TodoTag[]
): Todo | null {
  const next: Todo = { ...todo, updatedAt: Date.now() };

  if (changes.title !== undefined) next.title = changes.title;
  if ('notes' in changes) next.notes = changes.notes ?? undefined;
  if ('priority' in changes) next.priority = changes.priority;
  if ('dueDate' in changes) next.dueDate = changes.dueDate;
  if ('scheduledDate' in changes || 'scheduledTime' in changes) {
    const schedule = resolveNewTodoSchedule(
      changes.scheduledDate,
      changes.scheduledTime === undefined ? null : changes.scheduledTime
    );
    if (schedule === null) {
      return null;
    }
    next.scheduledDate = schedule.scheduledDate;
    next.scheduledTime = schedule.scheduledTime;
  }
  if ('estimateMinutes' in changes) next.estimateMinutes = changes.estimateMinutes;
  if ('goalId' in changes) next.goalId = changes.goalId;
  if (changes.listId) next.listId = changes.listId;
  if (changes.checklist !== undefined) {
    next.checklist = buildOptimisticChecklist(changes.checklist);
  }
  next.tag = resolveOptimisticTagChange(todo, changes, tags);

  return next;
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
    const optimisticTodo = buildOptimisticTodo(get(), todo);

    set((state) => ({
      todos: [...state.todos, optimisticTodo],
    }));

    try {
      const createdTodo = await todosService.addTodo(todo);
      const metadata = changesCanCreateMetadata(todo) ? await reloadMetadata() : undefined;

      set((state) => ({
        todos: state.todos.map((existingTodo) =>
          existingTodo.id === optimisticTodo.id ? createdTodo : existingTodo
        ),
        ...metadata,
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
    const existingTodo = get().todos.find((todo) => todo.id === todoId);
    const optimisticTodo = existingTodo
      ? applyOptimisticTodoChanges(existingTodo, changes, get().tags)
      : null;

    if (optimisticTodo) {
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === todoId ? optimisticTodo : todo)),
      }));
    }

    try {
      const updatedTodo = await todosService.updateTodo(todoId, changes);
      const metadata = changesCanCreateMetadata(changes) ? await reloadMetadata() : undefined;
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)),
        ...metadata,
      }));
      return updatedTodo;
    } catch (error) {
      if (existingTodo && optimisticTodo) {
        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === todoId ? existingTodo : todo)),
        }));
      }
      throw error;
    }
  },

  setTodoStatus: async (todoId, status, options = {}) => {
    const existingTodo = get().todos.find((todo) => todo.id === todoId);

    if (existingTodo) {
      const optimisticTodo = applyOptimisticTodoStatus(existingTodo, status, options);
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === todoId ? optimisticTodo : todo)),
      }));
    }

    try {
      const updatedTodo = await todosService.setTodoStatus(todoId, status, options);
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)),
      }));
      return updatedTodo;
    } catch (error) {
      if (existingTodo) {
        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === todoId ? existingTodo : todo)),
        }));
      }
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
    const now = Date.now();
    const optimisticList: TodoList = {
      id: `optimistic-list-${now}`,
      name: name.trim(),
      color,
      isInbox: false,
      sortOrder: get().lists.reduce((max, list) => Math.max(max, list.sortOrder + 1), 0),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ lists: sortLists([...state.lists, optimisticList]) }));

    try {
      const createdList = await todosService.createTodoList(name, color);
      set((state) => ({
        lists: sortLists(
          state.lists.map((list) => (list.id === optimisticList.id ? createdList : list))
        ),
      }));
      return createdList;
    } catch (error) {
      set((state) => ({ lists: state.lists.filter((list) => list.id !== optimisticList.id) }));
      throw error;
    }
  },

  updateTodoList: async (listId, changes) => {
    const existingList = get().lists.find((list) => list.id === listId);
    if (existingList) {
      set((state) => ({
        lists: state.lists.map((list) =>
          list.id === listId ? { ...list, ...changes, updatedAt: Date.now() } : list
        ),
      }));
    }

    try {
      const updatedList = await todosService.updateTodoList(listId, changes);
      set((state) => ({
        lists: state.lists.map((list) => (list.id === listId ? updatedList : list)),
      }));
      return updatedList;
    } catch (error) {
      if (existingList) {
        set((state) => ({
          lists: state.lists.map((list) => (list.id === listId ? existingList : list)),
        }));
      }
      throw error;
    }
  },

  deleteTodoList: async (listId) => {
    const { lists, todos } = get();
    const inboxId = lists.find((list) => list.isInbox)?.id;
    if (inboxId) {
      set({
        lists: lists.filter((list) => list.id !== listId),
        todos: sortTodosByPosition(moveTodosToList(todos, listId, inboxId)),
      });
    }

    try {
      await todosService.deleteTodoList(listId);
    } catch (error) {
      set({ lists, todos });
      throw error;
    }
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
