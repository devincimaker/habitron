import { supabase } from './supabase';
import type {
  Priority,
  Todo,
  TodoDraft,
  TodoList,
  TodoStatus,
  TodoTag,
} from '@habits-coach/shared';
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
  scheduled_block?: 'morning' | 'afternoon' | 'evening' | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  canceled_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DbTodoTagAssignment {
  todo_id: string;
  tag_id: string;
  todo_tags: DbTodoTag | DbTodoTag[] | null;
}

function getAssignedDbTodoTag(assignment: DbTodoTagAssignment): DbTodoTag | null {
  if (!assignment.todo_tags) {
    return null;
  }

  return Array.isArray(assignment.todo_tags)
    ? assignment.todo_tags[0] ?? null
    : assignment.todo_tags;
}

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

function mapDbTodoToTodo(todo: DbTodo, tags: TodoTag[]): Todo {
  const scheduledTime = todo.scheduled_time ?? mapLegacyScheduledBlockToTime(todo.scheduled_block);

  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes ?? undefined,
    status: todo.status,
    priority: todo.priority ?? undefined,
    dueDate: todo.due_date ?? undefined,
    scheduledDate: todo.scheduled_date ?? undefined,
    scheduledTime: scheduledTime ?? undefined,
    estimateMinutes: todo.estimate_minutes ?? undefined,
    completedAt: todo.completed_at ? new Date(todo.completed_at).getTime() : undefined,
    canceledAt: todo.canceled_at ? new Date(todo.canceled_at).getTime() : undefined,
    sortOrder: todo.sort_order,
    listId: todo.list_id,
    goalId: todo.goal_id ?? undefined,
    tags,
    createdAt: new Date(todo.created_at).getTime(),
    updatedAt: new Date(todo.updated_at).getTime(),
  };
}

function serializeScheduledTime(time?: string): string | null {
  const normalizedTime = normalizeTodoScheduledTimeInput(time);

  if (normalizedTime === null) {
    throw new Error('Invalid scheduled time');
  }

  return normalizedTime ?? null;
}

function mapLegacyScheduledBlockToTime(
  block?: DbTodo['scheduled_block']
): string | null {
  switch (block) {
    case 'morning':
      return '09:00';
    case 'afternoon':
      return '13:00';
    case 'evening':
      return '18:00';
    default:
      return null;
  }
}

function mapScheduledTimeToLegacyBlock(time?: string | null): DbTodo['scheduled_block'] {
  const normalizedTime = normalizeTodoScheduledTimeInput(time);

  if (!normalizedTime) {
    return null;
  }

  const hour = Number.parseInt(normalizedTime.slice(0, 2), 10);

  if (hour < 12) {
    return 'morning';
  }

  if (hour < 17) {
    return 'afternoon';
  }

  return 'evening';
}

function isMissingScheduledTimeSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  return maybeError.code === 'PGRST204'
    && typeof maybeError.message === 'string'
    && maybeError.message.includes("'scheduled_time'");
}

async function insertTodoRow(payload: Record<string, unknown>): Promise<DbTodo> {
  let { data, error } = await supabase
    .from('todos')
    .insert(payload)
    .select()
    .single();

  if (isMissingScheduledTimeSchemaError(error)) {
    const fallbackPayload: Record<string, unknown> = {
      ...payload,
      scheduled_block: mapScheduledTimeToLegacyBlock((payload.scheduled_time as string | null | undefined) ?? null),
    };
    delete fallbackPayload.scheduled_time;

    ({ data, error } = await supabase
      .from('todos')
      .insert(fallbackPayload)
      .select()
      .single());
  }

  if (error) {
    console.error('Error adding todo:', error);
    throw error;
  }

  return data as DbTodo;
}

async function updateTodoRow(todoId: string, payload: Partial<DbTodo>): Promise<void> {
  let { error } = await supabase
    .from('todos')
    .update(payload)
    .eq('id', todoId);

  if (isMissingScheduledTimeSchemaError(error)) {
    const fallbackPayload = {
      ...payload,
      scheduled_block: mapScheduledTimeToLegacyBlock(payload.scheduled_time),
    };
    delete fallbackPayload.scheduled_time;

    ({ error } = await supabase
      .from('todos')
      .update(fallbackPayload)
      .eq('id', todoId));
  }

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

async function getTodoTagAssignments(
  todoIds?: string[]
): Promise<Map<string, TodoTag[]>> {
  let query = supabase
    .from('todo_tag_assignments')
    .select('todo_id, tag_id, todo_tags(*)');

  if (todoIds && todoIds.length > 0) {
    query = query.in('todo_id', todoIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching todo tag assignments:', error);
    throw error;
  }

  const tagsByTodoId = new Map<string, TodoTag[]>();
  for (const assignment of data as DbTodoTagAssignment[]) {
    const dbTag = getAssignedDbTodoTag(assignment);
    if (!dbTag) {
      continue;
    }

    const tags = tagsByTodoId.get(assignment.todo_id) ?? [];
    tags.push(mapDbTodoTagToTodoTag(dbTag));
    tagsByTodoId.set(assignment.todo_id, tags);
  }

  return tagsByTodoId;
}

async function getTodoRow(todoId: string): Promise<DbTodo> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('id', todoId)
    .single();

  if (error) {
    console.error('Error fetching todo:', error);
    throw error;
  }

  return data as DbTodo;
}

async function getTodoById(todoId: string): Promise<Todo> {
  const todo = await getTodoRow(todoId);
  const tagsByTodoId = await getTodoTagAssignments([todoId]);
  return mapDbTodoToTodo(todo, tagsByTodoId.get(todoId) ?? []);
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

async function resolveTagIds(
  userId: string,
  input: Pick<TodoDraft, 'tagIds' | 'tagNames'>
): Promise<string[] | undefined> {
  if (input.tagIds !== undefined) {
    return input.tagIds;
  }

  if (input.tagNames === undefined) {
    return undefined;
  }

  const normalizedNames = Array.from(
    new Set(
      input.tagNames
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );

  if (normalizedNames.length === 0) {
    return [];
  }

  const { data: existing, error } = await supabase
    .from('todo_tags')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching todo tags:', error);
    throw error;
  }

  const existingTags = (existing as DbTodoTag[]).reduce((acc, tag) => {
    acc.set(tag.name.toLowerCase(), tag);
    return acc;
  }, new Map<string, DbTodoTag>());

  const resolvedIds: string[] = [];

  for (const name of normalizedNames) {
    const existingTag = existingTags.get(name.toLowerCase());
    if (existingTag) {
      resolvedIds.push(existingTag.id);
      continue;
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

    const createdTag = created as DbTodoTag;
    existingTags.set(createdTag.name.toLowerCase(), createdTag);
    resolvedIds.push(createdTag.id);
  }

  return resolvedIds;
}

async function syncTodoTags(todoId: string, userId: string, tagIds: string[]): Promise<void> {
  const { data: existingAssignments, error: existingError } = await supabase
    .from('todo_tag_assignments')
    .select('tag_id')
    .eq('todo_id', todoId);

  if (existingError) {
    console.error('Error fetching existing todo tag assignments:', existingError);
    throw existingError;
  }

  const existingTagIds = new Set(
    (existingAssignments as Array<{ tag_id: string }>).map((assignment) => assignment.tag_id)
  );
  const targetTagIds = new Set(tagIds);

  const toDelete = Array.from(existingTagIds).filter((tagId) => !targetTagIds.has(tagId));
  const toInsert = Array.from(targetTagIds).filter((tagId) => !existingTagIds.has(tagId));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('todo_tag_assignments')
      .delete()
      .eq('todo_id', todoId)
      .in('tag_id', toDelete);

    if (deleteError) {
      console.error('Error deleting todo tag assignments:', deleteError);
      throw deleteError;
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('todo_tag_assignments')
      .insert(
        toInsert.map((tagId) => ({
          user_id: userId,
          todo_id: todoId,
          tag_id: tagId,
        }))
      );

    if (insertError) {
      console.error('Error inserting todo tag assignments:', insertError);
      throw insertError;
    }
  }
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
    .select('*')
    .order('status', { ascending: true })
    .order('scheduled_date', { ascending: true })
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching todos:', error);
    throw error;
  }

  const todoRows = data as DbTodo[];
  const tagsByTodoId = await getTodoTagAssignments(todoRows.map((todo) => todo.id));

  return todoRows.map((todo) => mapDbTodoToTodo(todo, tagsByTodoId.get(todo.id) ?? []));
}

export async function addTodo(todo: TodoDraft): Promise<Todo> {
  const userId = await getCurrentUserId();
  const listId = await resolveListId(userId, todo);
  const tagIds = await resolveTagIds(userId, todo);
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
    sort_order: Date.now(),
  });

  if (tagIds !== undefined) {
    await syncTodoTags(createdTodo.id, userId, tagIds);
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
  if (changes.notes !== undefined) updateData.notes = changes.notes ?? null;
  if (changes.priority !== undefined) updateData.priority = changes.priority ?? null;
  if (changes.dueDate !== undefined) updateData.due_date = changes.dueDate ?? null;
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
  if (changes.estimateMinutes !== undefined) {
    updateData.estimate_minutes = changes.estimateMinutes ?? null;
  }
  if (changes.goalId !== undefined) updateData.goal_id = changes.goalId ?? null;

  if (changes.listId !== undefined || changes.listName !== undefined) {
    updateData.list_id = await resolveListId(userId, {
      listId: changes.listId,
      listName: changes.listName,
    });
  }

  if (Object.keys(updateData).length > 0) {
    await updateTodoRow(todoId, updateData);
  }

  const tagIds = await resolveTagIds(userId, {
    tagIds: changes.tagIds,
    tagNames: changes.tagNames,
  });

  if (tagIds !== undefined) {
    await syncTodoTags(todoId, userId, tagIds);
  }

  return getTodoById(todoId);
}

export async function setTodoStatus(todoId: string, status: TodoStatus): Promise<Todo> {
  const now = new Date().toISOString();
  const updateData: Partial<DbTodo> = {
    status,
  };

  if (status === 'completed') {
    updateData.completed_at = now;
    updateData.canceled_at = null;
  } else if (status === 'canceled') {
    updateData.completed_at = null;
    updateData.canceled_at = now;
  } else {
    updateData.completed_at = null;
    updateData.canceled_at = null;
  }

  const { error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', todoId);

  if (error) {
    console.error('Error updating todo status:', error);
    throw error;
  }

  return getTodoById(todoId);
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
