/* eslint-disable max-lines -- HAB-89: split pending */
import { supabase } from './supabase';
import type {
  ChecklistItem,
  ChecklistItemDraft,
  Priority,
  Todo,
  TodoDraft,
  TodoList,
  TodoStatus,
  TodoTag,
} from '@habits-coach/shared';
import { normalizeChecklistDraft } from '@habits-coach/shared';
import { getTodoTagColor } from '../utils/todoTagColors';
import { normalizeTodoScheduledTimeInput, resolveNewTodoSchedule } from '../utils/todoTime';

const DEFAULT_INBOX_NAME = 'Inbox';
const DEFAULT_INBOX_COLOR = '#F5A623';

interface DbTodoList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  is_inbox: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DbTodoTag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface DbTodo {
  id: string;
  user_id: string;
  goal_id: string | null;
  list_id: string;
  title: string;
  notes: string | null;
  status: TodoStatus;
  priority: Priority | null;
  due_date: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  completed_at: string | null;
  canceled_at: string | null;
  position: number;
  tag_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DbChecklistItem {
  id: string;
  user_id: string;
  todo_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface DbTodoWithRelations extends DbTodo {
  todo_tags: DbTodoTag | null;
  todo_checklist_items: DbChecklistItem[];
}

const TODO_SELECT = '*, todo_tags(*), todo_checklist_items(*)';

function mapDbTodoListToTodoList(list: DbTodoList): TodoList {
  return {
    id: list.id,
    name: list.name,
    color: list.color ?? undefined,
    isInbox: list.is_inbox,
    sortOrder: list.sort_order,
    createdAt: new Date(list.created_at).getTime(),
    updatedAt: new Date(list.updated_at).getTime(),
  };
}

function mapDbTodoTagToTodoTag(tag: DbTodoTag): TodoTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color ?? undefined,
    createdAt: new Date(tag.created_at).getTime(),
    updatedAt: new Date(tag.updated_at).getTime(),
  };
}

function mapDbChecklistItem(item: DbChecklistItem): ChecklistItem {
  return {
    id: item.id,
    title: item.title,
    done: item.done,
    position: item.position,
  };
}

function mapDbTodoToTodo(todo: DbTodoWithRelations): Todo {
  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes ?? undefined,
    status: todo.status,
    priority: todo.priority ?? undefined,
    dueDate: todo.due_date ?? undefined,
    scheduledDate: todo.scheduled_date ?? undefined,
    scheduledTime: todo.scheduled_time ?? undefined,
    estimateMinutes: todo.estimate_minutes ?? undefined,
    actualMinutes: todo.actual_minutes ?? undefined,
    completedAt: todo.completed_at ? new Date(todo.completed_at).getTime() : undefined,
    canceledAt: todo.canceled_at ? new Date(todo.canceled_at).getTime() : undefined,
    position: todo.position,
    listId: todo.list_id,
    goalId: todo.goal_id ?? undefined,
    tag: todo.todo_tags ? mapDbTodoTagToTodoTag(todo.todo_tags) : undefined,
    checklist: todo.todo_checklist_items.length
      ? [...todo.todo_checklist_items]
          .sort((a, b) => a.position - b.position)
          .map(mapDbChecklistItem)
      : undefined,
    createdAt: new Date(todo.created_at).getTime(),
    updatedAt: new Date(todo.updated_at).getTime(),
  };
}

/**
 * Makes the task's checklist match `drafts` exactly: items with an id are
 * updated, the rest inserted, existing items missing from the array deleted.
 * Positions follow array order.
 */
async function syncChecklist(
  userId: string,
  todoId: string,
  checklist: string[] | ChecklistItemDraft[]
): Promise<void> {
  const drafts = normalizeChecklistDraft(checklist);

  const { data: existingRows, error: fetchError } = await supabase
    .from('todo_checklist_items')
    .select('id')
    .eq('todo_id', todoId);

  if (fetchError) {
    console.error('Error fetching checklist items:', fetchError);
    throw fetchError;
  }

  const keptIds = new Set(drafts.flatMap((item) => (item.id ? [item.id] : [])));
  const removedIds = (existingRows as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('todo_checklist_items')
      .delete()
      .in('id', removedIds);

    if (error) {
      console.error('Error deleting checklist items:', error);
      throw error;
    }
  }

  const rows = drafts.map((item, position) => ({
    user_id: userId,
    todo_id: todoId,
    title: item.title,
    done: item.done ?? false,
    position,
  }));

  // PostgREST rejects a bulk write whose objects do not all carry the same keys
  // (PGRST102), and an item the user has just typed has no id yet — so the ones
  // being updated and the ones being created go in separate calls.
  const updates = rows.flatMap((row, index) => {
    const id = drafts[index].id;
    return id ? [{ ...row, id }] : [];
  });
  const inserts = rows.filter((_row, index) => !drafts[index].id);

  if (updates.length > 0) {
    const { error } = await supabase.from('todo_checklist_items').upsert(updates);

    if (error) {
      console.error('Error saving checklist items:', error);
      throw error;
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('todo_checklist_items').insert(inserts);

    if (error) {
      console.error('Error adding checklist items:', error);
      throw error;
    }
  }
}

export async function setChecklistItemDone(itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('todo_checklist_items')
    .update({ done })
    .eq('id', itemId);

  if (error) {
    console.error('Error updating checklist item:', error);
    throw error;
  }
}

function serializeScheduledTime(time?: string): string | null {
  const normalizedTime = normalizeTodoScheduledTimeInput(time);

  if (normalizedTime === null) {
    throw new Error('Invalid scheduled time');
  }

  return normalizedTime ?? null;
}

async function insertTodoRow(payload: Record<string, unknown>): Promise<DbTodo> {
  const { data, error } = await supabase
    .from('todos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error adding todo:', error);
    throw error;
  }

  return data as DbTodo;
}

async function updateTodoRow(todoId: string, payload: Partial<DbTodo>): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .update(payload)
    .eq('id', todoId);

  if (error) {
    console.error('Error updating todo:', error);
    throw error;
  }
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

async function ensureInboxList(userId: string): Promise<TodoList> {
  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .eq('user_id', userId)
    .eq('is_inbox', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching inbox list:', error);
    throw error;
  }

  if (data) {
    return mapDbTodoListToTodoList(data as DbTodoList);
  }

  const { data: created, error: createError } = await supabase
    .from('todo_lists')
    .insert({
      user_id: userId,
      name: DEFAULT_INBOX_NAME,
      color: DEFAULT_INBOX_COLOR,
      is_inbox: true,
      sort_order: 0,
    })
    .select()
    .single();

  if (createError) {
    if (createError.code === '23505') {
      const { data: existingAfterConflict, error: refetchError } = await supabase
        .from('todo_lists')
        .select('*')
        .eq('user_id', userId)
        .eq('is_inbox', true)
        .single();

      if (refetchError) {
        console.error('Error refetching inbox list after conflict:', refetchError);
        throw refetchError;
      }

      return mapDbTodoListToTodoList(existingAfterConflict as DbTodoList);
    }

    console.error('Error creating inbox list:', createError);
    throw createError;
  }

  return mapDbTodoListToTodoList(created as DbTodoList);
}

async function getTodoById(todoId: string): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .select(TODO_SELECT)
    .eq('id', todoId)
    .single();

  if (error) {
    console.error('Error fetching todo:', error);
    throw error;
  }

  return mapDbTodoToTodo(data as unknown as DbTodoWithRelations);
}

async function resolveListId(
  userId: string,
  input: Pick<TodoDraft, 'listId' | 'listName'>
): Promise<string> {
  if (input.listId) {
    return input.listId;
  }

  if (!input.listName?.trim()) {
    const inbox = await ensureInboxList(userId);
    return inbox.id;
  }

  const normalizedName = input.listName.trim();
  const { data: existing, error } = await supabase
    .from('todo_lists')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', normalizedName)
    .maybeSingle();

  if (error) {
    console.error('Error resolving todo list:', error);
    throw error;
  }

  if (existing) {
    return (existing as DbTodoList).id;
  }

  const { data: created, error: createError } = await supabase
    .from('todo_lists')
    .insert({
      user_id: userId,
      name: normalizedName,
      color: DEFAULT_INBOX_COLOR,
      sort_order: Date.now(),
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating todo list:', createError);
    throw createError;
  }

  return (created as DbTodoList).id;
}

/**
 * Resolves the draft's category to a tag id. `undefined` means "leave untouched",
 * `null` means "clear". A tagName that doesn't exist yet is created.
 */
async function resolveTagId(
  userId: string,
  input: Pick<TodoDraft, 'tagId' | 'tagName'>
): Promise<string | null | undefined> {
  if (input.tagId !== undefined) {
    return input.tagId;
  }

  if (input.tagName === undefined) {
    return undefined;
  }

  const name = input.tagName?.trim();
  if (!name) {
    return null;
  }

  const { data: existing, error } = await supabase
    .from('todo_tags')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name)
    .maybeSingle();

  if (error) {
    console.error('Error fetching todo tag:', error);
    throw error;
  }

  if (existing) {
    return (existing as DbTodoTag).id;
  }

  const { data: created, error: createError } = await supabase
    .from('todo_tags')
    .insert({
      user_id: userId,
      name,
      color: getTodoTagColor(name),
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating todo tag:', createError);
    throw createError;
  }

  return (created as DbTodoTag).id;
}

export async function getTodoLists(): Promise<TodoList[]> {
  const userId = await getCurrentUserId();
  await ensureInboxList(userId);

  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .order('is_inbox', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching todo lists:', error);
    throw error;
  }

  return (data as DbTodoList[]).map(mapDbTodoListToTodoList);
}

export async function createTodoList(name: string, color?: string): Promise<TodoList> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('todo_lists')
    .insert({
      user_id: userId,
      name: name.trim(),
      color: color ?? DEFAULT_INBOX_COLOR,
      sort_order: Date.now(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating todo list:', error);
    throw error;
  }

  return mapDbTodoListToTodoList(data as DbTodoList);
}

export async function updateTodoList(
  listId: string,
  changes: { name?: string; color?: string }
): Promise<TodoList> {
  const payload: Record<string, unknown> = {};
  if (changes.name !== undefined) payload.name = changes.name.trim();
  if (changes.color !== undefined) payload.color = changes.color;

  const { data, error } = await supabase
    .from('todo_lists')
    .update(payload)
    .eq('id', listId)
    .select()
    .single();

  if (error) {
    console.error('Error updating todo list:', error);
    throw error;
  }

  return mapDbTodoListToTodoList(data as DbTodoList);
}

/** Deletes a list; its tasks append to the Inbox in their old relative order. */
export async function deleteTodoList(listId: string): Promise<void> {
  const userId = await getCurrentUserId();

  const { data: list, error: listError } = await supabase
    .from('todo_lists')
    .select('is_inbox')
    .eq('id', listId)
    .single();

  if (listError) {
    console.error('Error fetching todo list:', listError);
    throw listError;
  }
  if ((list as Pick<DbTodoList, 'is_inbox'>).is_inbox) {
    throw new Error('The inbox cannot be deleted');
  }

  const inbox = await ensureInboxList(userId);

  const { data: doomed, error: doomedError } = await supabase
    .from('todos')
    .select('id')
    .eq('list_id', listId)
    .order('position', { ascending: true });

  if (doomedError) {
    console.error('Error fetching the list\'s todos:', doomedError);
    throw doomedError;
  }

  const base = await fetchNextTodoPosition(userId, inbox.id);
  const results = await Promise.all(
    (doomed as Array<{ id: string }>).map((todo, index) =>
      supabase
        .from('todos')
        .update({ list_id: inbox.id, position: base + index })
        .eq('id', todo.id)
    )
  );
  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error('Error moving todos to the inbox:', failure.error);
    throw failure.error;
  }

  // The RESTRICT FK on todos.list_id fails this loudly if any row was missed.
  const { error } = await supabase.from('todo_lists').delete().eq('id', listId);

  if (error) {
    console.error('Error deleting todo list:', error);
    throw error;
  }
}

export async function getTodoTags(): Promise<TodoTag[]> {
  const { data, error } = await supabase
    .from('todo_tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching todo tags:', error);
    throw error;
  }

  return (data as DbTodoTag[]).map(mapDbTodoTagToTodoTag);
}

export async function createTodoTag(name: string, color?: string): Promise<TodoTag> {
  const userId = await getCurrentUserId();
  const trimmedName = name.trim();

  const { data, error } = await supabase
    .from('todo_tags')
    .insert({
      user_id: userId,
      name: trimmedName,
      color: color ?? getTodoTagColor(trimmedName),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating todo tag:', error);
    throw error;
  }

  return mapDbTodoTagToTodoTag(data as DbTodoTag);
}

export async function getTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select(TODO_SELECT)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching todos:', error);
    throw error;
  }

  return (data as unknown as DbTodoWithRelations[]).map(mapDbTodoToTodo);
}

/** A new task appends to its list's manual order. */
async function fetchNextTodoPosition(userId: string, listId: string): Promise<number> {
  const { data, error } = await supabase
    .from('todos')
    .select('position')
    .eq('user_id', userId)
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error reading the last todo position:', error);
    throw error;
  }

  return data ? (data as Pick<DbTodo, 'position'>).position + 1 : 0;
}

export async function addTodo(todo: TodoDraft): Promise<Todo> {
  const userId = await getCurrentUserId();
  const [listId, tagId] = await Promise.all([
    resolveListId(userId, todo),
    resolveTagId(userId, todo),
  ]);
  const position = await fetchNextTodoPosition(userId, listId);
  const schedule = resolveNewTodoSchedule(todo.scheduledDate, todo.scheduledTime);

  if (schedule === null) {
    throw new Error('Invalid scheduled time');
  }

  const createdTodo = await insertTodoRow({
    user_id: userId,
    goal_id: todo.goalId ?? null,
    list_id: listId,
    title: todo.title,
    notes: todo.notes ?? null,
    status: 'open',
    priority: todo.priority ?? null,
    due_date: todo.dueDate ?? null,
    scheduled_date: schedule.scheduledDate ?? null,
    scheduled_time: serializeScheduledTime(schedule.scheduledTime),
    estimate_minutes: todo.estimateMinutes ?? null,
    tag_id: tagId ?? null,
    position,
  });

  if (todo.checklist?.length) {
    await syncChecklist(userId, createdTodo.id, todo.checklist);
  }

  return getTodoById(createdTodo.id);
}

export async function updateTodo(
  todoId: string,
  changes: Partial<TodoDraft>
): Promise<Todo> {
  const userId = await getCurrentUserId();
  const updateData: Partial<DbTodo> = {};

  if (changes.title !== undefined) updateData.title = changes.title;
  // These five test for the key rather than the value, the way the schedule
  // pair below already does: `{ priority: undefined }` is how a caller says
  // "clear it", and reading the value instead makes that a silent no-op.
  if ('notes' in changes) updateData.notes = changes.notes ?? null;
  if ('priority' in changes) updateData.priority = changes.priority ?? null;
  if ('dueDate' in changes) updateData.due_date = changes.dueDate ?? null;
  if ('scheduledDate' in changes || 'scheduledTime' in changes) {
    const resolvedSchedule = resolveNewTodoSchedule(
      changes.scheduledDate,
      changes.scheduledTime === undefined ? null : changes.scheduledTime
    );

    if (resolvedSchedule === null) {
      throw new Error('Invalid scheduled time');
    }

    updateData.scheduled_date = resolvedSchedule.scheduledDate ?? null;
    updateData.scheduled_time = serializeScheduledTime(resolvedSchedule.scheduledTime);
  }
  if ('estimateMinutes' in changes) {
    updateData.estimate_minutes = changes.estimateMinutes ?? null;
  }
  if ('goalId' in changes) updateData.goal_id = changes.goalId ?? null;

  const tagId = await resolveTagId(userId, changes);
  if (tagId !== undefined) updateData.tag_id = tagId;

  if (changes.listId !== undefined || changes.listName !== undefined) {
    const targetListId = await resolveListId(userId, {
      listId: changes.listId,
      listName: changes.listName,
    });
    const { data: currentRow, error: currentError } = await supabase
      .from('todos')
      .select('list_id')
      .eq('id', todoId)
      .single();

    if (currentError) {
      console.error('Error reading the todo before a list move:', currentError);
      throw currentError;
    }

    // Moving lists appends to the target; a same-list save must not move the task.
    if ((currentRow as Pick<DbTodo, 'list_id'>).list_id !== targetListId) {
      updateData.list_id = targetListId;
      updateData.position = await fetchNextTodoPosition(userId, targetListId);
    }
  }

  if (Object.keys(updateData).length > 0) {
    await updateTodoRow(todoId, updateData);
  }

  if (changes.checklist !== undefined) {
    await syncChecklist(userId, todoId, changes.checklist);
  }

  return getTodoById(todoId);
}

export interface TodoStatusOptions {
  /** Minutes the task actually took. Only stored when the status is 'completed'. */
  actualMinutes?: number;
}

export async function setTodoStatus(
  todoId: string,
  status: TodoStatus,
  options: TodoStatusOptions = {}
): Promise<Todo> {
  const now = new Date().toISOString();
  const updateData: Partial<DbTodo> = {
    status,
    completed_at: status === 'completed' ? now : null,
    canceled_at: status === 'canceled' ? now : null,
    actual_minutes: status === 'completed' ? options.actualMinutes ?? null : null,
  };

  await updateTodoRow(todoId, updateData);

  return getTodoById(todoId);
}

export interface TodoOrderUpdate {
  id: string;
  position: number;
}

/**
 * One update per changed row, like reorderHabits: todos.user_id, list_id and
 * title are NOT NULL with no default, so a partial upsert is not an option. A
 * drop touches at most one screen's worth of rows.
 */
export async function reorderTodos(updates: TodoOrderUpdate[]): Promise<void> {
  const results = await Promise.all(
    updates.map((update) =>
      supabase.from('todos').update({ position: update.position }).eq('id', update.id)
    )
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error('Error reordering todos:', failure.error);
    throw failure.error;
  }
}

export async function removeTodo(todoId: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId);

  if (error) {
    console.error('Error removing todo:', error);
    throw error;
  }
}
