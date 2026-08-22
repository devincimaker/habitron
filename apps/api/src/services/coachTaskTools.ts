import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type {
  ChatRequest,
  Todo,
  TodoStatus,
} from '@habits-coach/shared';
import { config } from '../config.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface DbTodoRow {
  id: string;
  user_id: string;
  goal_id: string | null;
  list_id: string;
  title: string;
  notes: string | null;
  status: TodoStatus;
  priority: number | null;
  due_date: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  completed_at: string | null;
  canceled_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CoachTaskRecord {
  id: string;
  title: string;
  notes?: string;
  status: TodoStatus;
  priority?: number;
  dueDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  estimateMinutes?: number;
  actualMinutes?: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CoachTaskOverview {
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  canceledTasks: number;
  scheduledTodayOpenTasks: number;
  unscheduledOpenTasks: number;
  overdueOpenTasks: number;
  duplicateOpenTitleGroups: number;
  sampleOpenTasks: CoachTaskRecord[];
}

interface TaskToolInputSource {
  userId?: string;
  todos?: ChatRequest['todos'];
}

interface ListTaskArgs extends TaskToolInputSource {
  today?: string;
  status?: TodoStatus;
  query?: string;
  ids?: string[];
  scheduledDate?: string;
  overdueOnly?: boolean;
  limit?: number;
}

interface DuplicateTaskArgs extends TaskToolInputSource {
  limit?: number;
}

export interface CoachDuplicateTaskGroup {
  normalizedTitle: string;
  tasks: CoachTaskRecord[];
}

function mapTodoToCoachTask(todo: Todo): CoachTaskRecord {
  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes,
    status: todo.status,
    priority: todo.priority,
    dueDate: todo.dueDate,
    scheduledDate: todo.scheduledDate,
    scheduledTime: todo.scheduledTime,
    estimateMinutes: todo.estimateMinutes,
    actualMinutes: todo.actualMinutes,
    sortOrder: todo.sortOrder,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}

function mapDbTodoToCoachTask(todo: DbTodoRow): CoachTaskRecord {
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
    sortOrder: todo.sort_order,
    createdAt: new Date(todo.created_at).getTime(),
    updatedAt: new Date(todo.updated_at).getTime(),
  };
}

export function normalizeTaskTitleForGrouping(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\(duplicate\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortTasksForCoach(tasks: CoachTaskRecord[], today?: string): CoachTaskRecord[] {
  return [...tasks].sort((left, right) => {
    const leftScheduledToday = Number(Boolean(today && left.scheduledDate === today));
    const rightScheduledToday = Number(Boolean(today && right.scheduledDate === today));
    if (rightScheduledToday !== leftScheduledToday) {
      return rightScheduledToday - leftScheduledToday;
    }

    const leftOverdue = Number(Boolean(today && left.dueDate && left.dueDate < today));
    const rightOverdue = Number(Boolean(today && right.dueDate && right.dueDate < today));
    if (rightOverdue !== leftOverdue) {
      return rightOverdue - leftOverdue;
    }

    const leftPriority = left.priority ?? 5;
    const rightPriority = right.priority ?? 5;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    if ((left.scheduledDate ?? '') !== (right.scheduledDate ?? '')) {
      return (left.scheduledDate ?? '').localeCompare(right.scheduledDate ?? '');
    }

    return left.sortOrder - right.sortOrder;
  });
}

async function fetchCoachTasks(source: TaskToolInputSource): Promise<CoachTaskRecord[]> {
  if (source.userId) {
    const { data, error } = await supabase
      .from('todos')
      .select(
        'id, user_id, goal_id, list_id, title, notes, status, priority, due_date, scheduled_date, scheduled_time, estimate_minutes, actual_minutes, completed_at, canceled_at, sort_order, created_at, updated_at'
      )
      .eq('user_id', source.userId);

    if (error) {
      throw error;
    }

    return ((data ?? []) as DbTodoRow[]).map(mapDbTodoToCoachTask);
  }

  if (source.todos) {
    return source.todos.map(mapTodoToCoachTask);
  }

  return [];
}

function filterTasks(tasks: CoachTaskRecord[], args: ListTaskArgs): CoachTaskRecord[] {
  const normalizedQuery = args.query?.trim().toLowerCase();
  const requestedIds = args.ids ? new Set(args.ids) : null;

  return tasks.filter((task) => {
    if (args.status && task.status !== args.status) {
      return false;
    }

    if (requestedIds && !requestedIds.has(task.id)) {
      return false;
    }

    if (args.scheduledDate && task.scheduledDate !== args.scheduledDate) {
      return false;
    }

    if (args.overdueOnly) {
      if (!args.today || !task.dueDate || task.dueDate >= args.today || task.status !== 'open') {
        return false;
      }
    }

    if (normalizedQuery) {
      const haystack = [task.title, task.notes ?? ''].join(' ').toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}

export async function getCoachTaskOverview(
  args: TaskToolInputSource & { today?: string }
): Promise<CoachTaskOverview> {
  const tasks = await fetchCoachTasks(args);
  const openTasks = tasks.filter((task) => task.status === 'open');
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const canceledTasks = tasks.filter((task) => task.status === 'canceled');
  const scheduledTodayOpenTasks = args.today
    ? openTasks.filter((task) => task.scheduledDate === args.today)
    : [];
  const overdueOpenTasks = args.today
    ? openTasks.filter((task) => task.dueDate && task.dueDate < (args.today ?? ''))
    : [];
  const unscheduledOpenTasks = openTasks.filter((task) => !task.scheduledDate);

  const duplicateOpenTitleGroups = Array.from(
    openTasks.reduce((groups, task) => {
      const key = normalizeTaskTitleForGrouping(task.title);
      const existing = groups.get(key) ?? [];
      existing.push(task);
      groups.set(key, existing);
      return groups;
    }, new Map<string, CoachTaskRecord[]>()).values()
  ).filter((group) => group.length > 1).length;

  return {
    totalTasks: tasks.length,
    openTasks: openTasks.length,
    completedTasks: completedTasks.length,
    canceledTasks: canceledTasks.length,
    scheduledTodayOpenTasks: scheduledTodayOpenTasks.length,
    unscheduledOpenTasks: unscheduledOpenTasks.length,
    overdueOpenTasks: overdueOpenTasks.length,
    duplicateOpenTitleGroups,
    sampleOpenTasks: sortTasksForCoach(openTasks, args.today).slice(0, 8),
  };
}

export async function listCoachTasks(args: ListTaskArgs): Promise<CoachTaskRecord[]> {
  const tasks = await fetchCoachTasks(args);
  return sortTasksForCoach(filterTasks(tasks, args), args.today).slice(0, args.limit ?? 12);
}

export async function findCoachDuplicateTasks(
  args: DuplicateTaskArgs
): Promise<CoachDuplicateTaskGroup[]> {
  const tasks = await fetchCoachTasks(args);
  const openTasks = tasks.filter((task) => task.status === 'open');

  return Array.from(
    openTasks.reduce((groups, task) => {
      const key = normalizeTaskTitleForGrouping(task.title);
      const existing = groups.get(key) ?? [];
      existing.push(task);
      groups.set(key, existing);
      return groups;
    }, new Map<string, CoachTaskRecord[]>()).entries()
  )
    .filter(([, group]) => group.length > 1)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, args.limit ?? 6)
    .map(([normalizedTitle, tasksForTitle]) => ({
      normalizedTitle,
      tasks: sortTasksForCoach(tasksForTitle),
    }));
}

export async function resolveCoachTaskMap(
  args: TaskToolInputSource & { ids: string[] }
): Promise<Map<string, CoachTaskRecord>> {
  if (args.ids.length === 0) {
    return new Map();
  }

  const tasks = await listCoachTasks({
    ...args,
    ids: args.ids,
    limit: args.ids.length,
  });

  return new Map(tasks.map((task) => [task.id, task]));
}

function toTaskToolPayload(task: CoachTaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    notes: task.notes ?? null,
    priority: task.priority ?? null,
    dueDate: task.dueDate ?? null,
    scheduledDate: task.scheduledDate ?? null,
    scheduledTime: task.scheduledTime ?? null,
    estimateMinutes: task.estimateMinutes ?? null,
    actualMinutes: task.actualMinutes ?? null,
    sortOrder: task.sortOrder,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}

function parseToolArgs(rawArguments: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawArguments);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
}

function asTodoStatus(value: unknown): TodoStatus | undefined {
  return value === 'open' || value === 'completed' || value === 'canceled'
    ? value
    : undefined;
}

function asLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(20, Math.floor(value)));
}

export function getCoachTaskToolDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_task_overview',
        description: 'Get a compact overview of the current task system before planning or cleanup.',
        parameters: {
          type: 'object',
          properties: {
            today: {
              type: 'string',
              description: 'Optional YYYY-MM-DD date for overdue and scheduled-today calculations.',
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_tasks',
        description: 'List concrete tasks by status, text query, ids, date, or overdue state.',
        parameters: {
          type: 'object',
          properties: {
            today: { type: 'string' },
            status: {
              type: 'string',
              enum: ['open', 'completed', 'canceled'],
            },
            query: { type: 'string' },
            ids: {
              type: 'array',
              items: { type: 'string' },
            },
            scheduledDate: { type: 'string' },
            overdueOnly: { type: 'boolean' },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'find_duplicate_tasks',
        description: 'Find likely duplicate open tasks grouped by normalized title.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_task_details',
        description: 'Fetch exact current records for specific task ids before proposing edits or removals.',
        parameters: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' },
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
            },
          },
          required: ['ids'],
          additionalProperties: false,
        },
      },
    },
  ];
}

export async function executeCoachTaskToolCall(args: {
  toolName: string;
  rawArguments: string;
  source: TaskToolInputSource;
  today?: string;
}): Promise<Record<string, unknown>> {
  const parsedArgs = parseToolArgs(args.rawArguments);
  const today = asString(parsedArgs.today) ?? args.today;

  if (args.toolName === 'get_task_overview') {
    const overview = await getCoachTaskOverview({
      ...args.source,
      today,
    });

    return {
      overview: {
        ...overview,
        sampleOpenTasks: overview.sampleOpenTasks.map(toTaskToolPayload),
      },
    };
  }

  if (args.toolName === 'list_tasks') {
    const tasks = await listCoachTasks({
      ...args.source,
      today,
      status: asTodoStatus(parsedArgs.status),
      query: asString(parsedArgs.query),
      ids: asStringArray(parsedArgs.ids),
      scheduledDate: asString(parsedArgs.scheduledDate),
      overdueOnly: asBoolean(parsedArgs.overdueOnly),
      limit: asLimit(parsedArgs.limit, 12),
    });

    return {
      tasks: tasks.map(toTaskToolPayload),
    };
  }

  if (args.toolName === 'find_duplicate_tasks') {
    const groups = await findCoachDuplicateTasks({
      ...args.source,
      limit: asLimit(parsedArgs.limit, 6),
    });

    return {
      groups: groups.map((group) => ({
        normalizedTitle: group.normalizedTitle,
        tasks: group.tasks.map(toTaskToolPayload),
      })),
    };
  }

  if (args.toolName === 'get_task_details') {
    const ids = asStringArray(parsedArgs.ids) ?? [];
    const tasks = await listCoachTasks({
      ...args.source,
      today,
      ids,
      limit: asLimit(parsedArgs.limit, ids.length || 8),
    });

    return {
      tasks: tasks.map(toTaskToolPayload),
    };
  }

  return {
    error: `Unknown tool: ${args.toolName}`,
  };
}
