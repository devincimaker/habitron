/* eslint-disable max-lines -- HAB-89: split pending */
import { z } from 'zod';
import { buildDayContext } from './context.js';
import type { Db, PlanItemInput } from './db.js';
import { buildHabitHistory, buildJournalHistory, buildTaskHistory } from './history.js';
import { instantFrom, isIsoDate, isIsoDateTime, today } from './time.js';

/**
 * One tool definition, independent of the host. `apps/mcp` registers these on a
 * stdio McpServer for Claude Code; `apps/api` registers the same list on the
 * Agent SDK's in-process MCP server for the in-app coach.
 */
export interface HabitronTool<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>;
}

export type AnyHabitronTool = HabitronTool<any>;

function defineTool<Shape extends z.ZodRawShape>(tool: HabitronTool<Shape>): AnyHabitronTool {
  return tool;
}

const dateSchema = z
  .string()
  .refine(isIsoDate, 'Expected YYYY-MM-DD')
  .describe('YYYY-MM-DD');
const timeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Expected HH:MM (24h)')
  .describe('HH:MM, 24h');
const dateTimeSchema = z
  .string()
  .refine(isIsoDateTime, 'Expected YYYY-MM-DDTHH:MM')
  .describe('YYYY-MM-DDTHH:MM, local wall clock (seconds optional, ignored)');
const prioritySchema = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
  .describe('1 = highest, 4 = lowest');
const todoStatusSchema = z.enum(['open', 'completed', 'canceled']);
const habitStatusSchema = z.enum(['pending', 'completed', 'skipped']);
const moodSchema = z.enum(['great', 'good', 'neutral', 'bad', 'terrible']);
const memoryCategorySchema = z.enum([
  'motivation',
  'obstacle',
  'preference',
  'personal',
  'goal',
  'general',
]);
const outcomeSchema = z.enum([
  'planned',
  'completed_as_planned',
  'completed_after_adjustment',
  'deferred',
  'removed',
  'canceled',
  'not_done',
]);

export function createTools(db: Db, timezone: string): AnyHabitronTool[] {
  const now = () => today(timezone);

  return [
    // ------------------------------------------------------------------ reads

    defineTool({
      name: 'get_day_context',
      title: 'Get day context',
      description:
        'The planning packet for one day: local now, tasks (scheduled for the date, overdue, due soon, unscheduled), active habits with completion signal, the active accepted plan, recent journal entries, memories, and a summary of how the last 14 days of plans went. Call this first before planning, replanning, or reviewing a day.',
      inputSchema: { date: dateSchema.optional().describe('Defaults to today') },
      annotations: { readOnlyHint: true },
      handler: ({ date }) => buildDayContext(db, timezone, date ?? now()),
    }),

    defineTool({
      name: 'list_tasks',
      title: 'List tasks',
      description: 'Filter tasks. All filters are optional and combine with AND.',
      inputSchema: {
        status: todoStatusSchema.optional(),
        query: z.string().optional().describe('Case-insensitive substring over title and notes'),
        scheduledDate: dateSchema.optional(),
        unscheduledOnly: z.boolean().optional(),
        overdueOnly: z.boolean().optional().describe('Open tasks with dueDate before today'),
        limit: z.int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true },
      handler: async (args) => {
        const current = now();
        const q = args.query?.trim().toLowerCase();
        const tasks = (await db.listAllTasks()).filter((t) => {
          if (args.status && t.status !== args.status) return false;
          if (args.scheduledDate && t.scheduledDate !== args.scheduledDate) return false;
          if (args.unscheduledOnly && t.scheduledDate) return false;
          if (args.overdueOnly && !(t.status === 'open' && t.dueDate && t.dueDate < current)) return false;
          if (q && !`${t.title} ${t.notes ?? ''}`.toLowerCase().includes(q)) return false;
          return true;
        });
        return { tasks: tasks.slice(0, args.limit ?? 50), total: tasks.length };
      },
    }),

    defineTool({
      name: 'list_habits',
      title: 'List habits',
      description: 'Active habits (optionally including archived ones).',
      inputSchema: { includeInactive: z.boolean().optional() },
      annotations: { readOnlyHint: true },
      handler: ({ includeInactive }) => db.listHabits(includeInactive ?? false),
    }),

    defineTool({
      name: 'get_habit_history',
      title: 'Get habit history',
      description:
        'How habits have actually gone over a window (default 30 days, max 365): per habit, expected vs completed, completion rate, current/longest streak, first-half vs second-half trend, completion by weekday, quantity totals, and a day-by-day grid. Use for "how are my habits going?", spotting patterns, and deciding what to change.',
      inputSchema: {
        days: z.int().min(7).max(365).optional().describe('Window ending today; default 30'),
        habitId: z.uuid().optional().describe('Limit to one habit (includes archived ones)'),
      },
      annotations: { readOnlyHint: true },
      handler: ({ days, habitId }) => buildHabitHistory(db, timezone, { days: days ?? 30, habitId }),
    }),

    defineTool({
      name: 'get_task_history',
      title: 'Get task history',
      description:
        'What got done over a window (default 30 days, max 365): completed/canceled/created counts, completions per weekday and time of day, estimate-vs-actual accuracy, plan outcome tallies, open-task age, and the list of completed tasks with times. Use to understand real capacity and rhythms before planning.',
      inputSchema: { days: z.int().min(7).max(365).optional().describe('Window ending today; default 30') },
      annotations: { readOnlyHint: true },
      handler: ({ days }) => buildTaskHistory(db, timezone, { days: days ?? 30 }),
    }),

    defineTool({
      name: 'get_journal_history',
      title: 'Get journal history',
      description: 'Journal entries and mood counts over a window (default 30 days, max 365).',
      inputSchema: { days: z.int().min(7).max(365).optional().describe('Window ending today; default 30') },
      annotations: { readOnlyHint: true },
      handler: ({ days }) => buildJournalHistory(db, timezone, { days: days ?? 30 }),
    }),

    defineTool({
      name: 'get_plan_history',
      title: 'Get plan history',
      description:
        'Every plan version (with items and outcomes) for dates in [start, end]. Useful to study how planned days actually went.',
      inputSchema: { start: dateSchema, end: dateSchema },
      annotations: { readOnlyHint: true },
      handler: ({ start, end }) => db.listPlans(start, end),
    }),

    defineTool({
      name: 'list_tags',
      title: 'List tags',
      description:
        'The task categories (tags). Every task carries at most one tag, naming the part of life it affects (e.g. Health, Work, Relationships). Call before assigning a tag so existing names are reused.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      handler: () => db.listTags(),
    }),

    defineTool({
      name: 'list_memories',
      title: 'List memories',
      description: 'Durable facts the coach has learned about the user.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      handler: () => db.listMemories(),
    }),

    // ------------------------------------------------------------------ tasks

    defineTool({
      name: 'create_task',
      title: 'Create task',
      description:
        'Create a task in the inbox. Set scheduledDate (+ scheduledTime) to put it on a day. Give it a tagId so it belongs to a category; unknown ids are rejected. Several small things that belong together (a grocery list, errands at one place) are one task with a checklist, not N tasks. To record something already done, pass completedAt — the task is created already checked — and set scheduledDate/scheduledTime to when it happened, so it lands on that day everywhere.',
      inputSchema: {
        title: z.string().min(1),
        notes: z.string().optional(),
        priority: prioritySchema.optional(),
        dueDate: dateSchema.optional(),
        scheduledDate: dateSchema.optional(),
        scheduledTime: timeSchema.optional(),
        estimateMinutes: z.int().positive().optional(),
        tagId: z.uuid().optional().describe('Category; see list_tags'),
        checklist: z
          .array(z.string().min(1))
          .optional()
          .describe('Checklist item titles in order (e.g. ["milk", "eggs", "bread"])'),
        completedAt: dateTimeSchema
          .optional()
          .describe('When it was actually done. Creates the task already completed'),
        actualMinutes: z
          .int()
          .positive()
          .optional()
          .describe('How long it took. Only with completedAt'),
      },
      // The local wall clock becomes an instant here, so db.ts stays timezone-free.
      handler: ({ completedAt, ...rest }) =>
        db.createTask({
          ...rest,
          ...(completedAt ? { completedAt: instantFrom(completedAt, timezone) } : {}),
        }),
    }),

    defineTool({
      name: 'update_task',
      title: 'Update task',
      description:
        'Edit, schedule, reschedule, unschedule, or re-categorise a task. Pass null to clear a field; omit fields to leave them unchanged. Clearing scheduledDate also clears scheduledTime.',
      inputSchema: {
        id: z.uuid(),
        title: z.string().min(1).optional(),
        notes: z.string().nullable().optional(),
        priority: prioritySchema.nullable().optional(),
        dueDate: dateSchema.nullable().optional(),
        scheduledDate: dateSchema.nullable().optional(),
        scheduledTime: timeSchema.nullable().optional(),
        estimateMinutes: z.int().positive().nullable().optional(),
        tagId: z.uuid().nullable().optional().describe('Category; see list_tags. null clears it'),
        checklist: z
          .array(z.string().min(1))
          .optional()
          .describe(
            'Replaces the full checklist in order ([] clears it). Items whose title matches an existing one keep their done state.'
          ),
      },
      handler: ({ id, ...patch }) => db.updateTask(id, patch),
    }),

    defineTool({
      name: 'set_checklist_item_done',
      title: 'Set checklist item done',
      description: "Tick or untick one checklist item on a task. Item ids come from the task's checklist.",
      inputSchema: { itemId: z.uuid(), done: z.boolean() },
      handler: ({ itemId, done }) => db.setChecklistItemDone(itemId, done),
    }),

    defineTool({
      name: 'set_task_status',
      title: 'Set task status',
      description:
        'Complete, cancel, or reopen a task. When completing, pass actualMinutes if known — it feeds future estimates.',
      inputSchema: {
        id: z.uuid(),
        status: todoStatusSchema,
        actualMinutes: z.int().positive().optional(),
      },
      handler: ({ id, status, actualMinutes }) => db.setTaskStatus(id, status, actualMinutes),
    }),

    defineTool({
      name: 'delete_task',
      title: 'Delete task',
      description:
        'Permanently delete a task (e.g. a duplicate). Prefer cancel for tasks that were real but are no longer wanted.',
      inputSchema: { id: z.uuid() },
      annotations: { destructiveHint: true },
      handler: async ({ id }) => {
        await db.deleteTask(id);
        return { deleted: id };
      },
    }),

    // ------------------------------------------------------------------- tags

    defineTool({
      name: 'create_tag',
      title: 'Create tag',
      description:
        'Create a new task category. Prefer reusing an existing tag from list_tags; names are unique per user (case-insensitive).',
      inputSchema: {
        name: z.string().min(1),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB').optional(),
      },
      handler: ({ name, color }) => db.createTag(name, color),
    }),

    defineTool({
      name: 'update_tag',
      title: 'Update tag',
      description:
        'Rename or recolour an existing category. Every task keeps its link, so this is the safe way to fix a category whose name no longer fits. Names are unique per user (case-insensitive).',
      inputSchema: {
        id: z.uuid(),
        name: z.string().min(1).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB')
          .nullable()
          .optional()
          .describe('null clears the colour'),
      },
      handler: ({ id, name, color }) => db.updateTag(id, { name, color }),
    }),

    defineTool({
      name: 'delete_tag',
      title: 'Delete tag',
      description:
        'Delete a category. Tasks are never deleted, but any task still carrying this tag becomes uncategorised — pass reassignToTagId to move them to another category first. Destructive: check list_tags and confirm with the user before calling. The result reports how many tasks were affected.',
      inputSchema: {
        id: z.uuid(),
        reassignToTagId: z
          .uuid()
          .optional()
          .describe("Move this tag's tasks here before deleting; otherwise they lose their category"),
      },
      annotations: { destructiveHint: true },
      handler: ({ id, reassignToTagId }) => db.deleteTag(id, reassignToTagId),
    }),

    // ----------------------------------------------------------------- habits

    defineTool({
      name: 'log_habit',
      title: 'Log habit',
      description:
        "Mark a habit completed, skipped, or pending for a date (defaults to today). For quantity habits, pass amount (progress in the habit's unit).",
      inputSchema: {
        habitId: z.uuid(),
        status: habitStatusSchema,
        date: dateSchema.optional(),
        amount: z.number().nonnegative().optional(),
      },
      handler: ({ habitId, status, date, amount }) =>
        db.logHabit({ habitId, status, amount, date: date ?? now() }),
    }),

    // ------------------------------------------------------------------ plans

    defineTool({
      name: 'save_day_plan',
      title: 'Save day plan',
      description:
        'Accept a plan for a date, superseding any previous plan for that date (versions are kept). Items are executed in the order given: their position in the array is the sequence. Do NOT set scheduledTime unless the item genuinely happens at a fixed time (a class, a meeting, a call, a store that closes) — inventing clock times for ordinary tasks is wrong. Invariant: every todo item is also scheduled on the date, at its scheduledTime when it has one, so the plan and the Tasks screen never drift. Items: todo (todoId), habit (habitId), or note (free text with no backing entity). Call only after the user has agreed to the plan.',
      inputSchema: {
        date: dateSchema,
        rationale: z.string().optional().describe('One short paragraph on why the day looks like this'),
        items: z
          .array(
            z.object({
              itemType: z.enum(['todo', 'habit', 'note']),
              todoId: z.uuid().optional(),
              habitId: z.uuid().optional(),
              title: z.string().optional().describe('Required for notes; defaults to the entity title otherwise'),
              notes: z.string().optional(),
              scheduledTime: timeSchema
                .optional()
                .describe(
                  'Only for real appointments — a class, meeting, call, or a store that closes. Omit it for everything else; plan items are ordered by their position in this array.'
                ),
              estimateMinutes: z.int().positive().optional(),
              isOptional: z.boolean().optional(),
            })
          )
          .min(1),
      },
      handler: async ({ date, rationale, items }) => {
        const todoIds = items.flatMap((i) => (i.itemType === 'todo' && i.todoId ? [i.todoId] : []));
        const habitIds = items.flatMap((i) => (i.itemType === 'habit' && i.habitId ? [i.habitId] : []));
        const [todos, habits] = await Promise.all([db.getTasksByIds(todoIds), db.getHabitsByIds(habitIds)]);

        const resolved: PlanItemInput[] = items.map((item, index) => {
          if (item.itemType === 'todo') {
            const todo = item.todoId ? todos.get(item.todoId) : undefined;
            if (!todo) throw new Error(`items[${index}]: todo not found (${item.todoId ?? 'missing todoId'})`);
            if (todo.status !== 'open') throw new Error(`items[${index}]: todo "${todo.title}" is ${todo.status}`);
            return {
              itemType: 'todo',
              todoId: todo.id,
              title: item.title ?? todo.title,
              notes: item.notes ?? todo.notes,
              scheduledTime: item.scheduledTime,
              estimateMinutes: item.estimateMinutes ?? todo.estimateMinutes,
              isOptional: item.isOptional ?? false,
            };
          }
          if (item.itemType === 'habit') {
            const habit = item.habitId ? habits.get(item.habitId) : undefined;
            if (!habit) throw new Error(`items[${index}]: habit not found (${item.habitId ?? 'missing habitId'})`);
            return {
              itemType: 'habit',
              habitId: habit.id,
              title: item.title ?? habit.name,
              notes: item.notes,
              scheduledTime: item.scheduledTime,
              estimateMinutes: item.estimateMinutes,
              isOptional: item.isOptional ?? false,
            };
          }
          if (!item.title) throw new Error(`items[${index}]: note items need a title`);
          return {
            itemType: 'note',
            title: item.title,
            notes: item.notes,
            scheduledTime: item.scheduledTime,
            estimateMinutes: item.estimateMinutes,
            isOptional: item.isOptional ?? false,
          };
        });

        // Keep todos in sync with the plan (the invariant from the v1 planning doc).
        await Promise.all(
          resolved
            .filter((i) => i.itemType === 'todo')
            .map((i) =>
              db.updateTask(i.todoId as string, {
                scheduledDate: date,
                scheduledTime: i.scheduledTime ?? null,
                estimateMinutes: i.estimateMinutes ?? undefined,
              })
            )
        );

        return db.saveAcceptedPlan({ date, rationale, items: resolved });
      },
    }),

    defineTool({
      name: 'set_plan_item_outcome',
      title: 'Set plan item outcome',
      description:
        'Record what happened to a planned item. Use with set_task_status when closing out tasks, and for habit/note items that have no task.',
      inputSchema: { itemId: z.uuid(), outcome: outcomeSchema },
      handler: ({ itemId, outcome }) => db.setPlanItemOutcome(itemId, outcome),
    }),

    // --------------------------------------------------------- journal/memory

    defineTool({
      name: 'add_journal_entry',
      title: 'Add journal entry',
      description:
        'Save a short reflective entry (defaults to today). Use for check-ins, end-of-day reviews, or notable context.',
      inputSchema: {
        content: z.string().min(1),
        mood: moodSchema.optional(),
        entryDate: dateSchema.optional(),
      },
      handler: ({ content, mood, entryDate }) =>
        db.addJournalEntry({ content, mood, entryDate: entryDate ?? now() }),
    }),

    defineTool({
      name: 'add_memory',
      title: 'Add memory',
      description:
        'Store a durable fact about the user for future planning (stable preferences, constraints, observed patterns). Not for one-off details.',
      inputSchema: { content: z.string().min(1), category: memoryCategorySchema },
      handler: ({ content, category }) => db.addMemory(content, category),
    }),

    defineTool({
      name: 'delete_memory',
      title: 'Delete memory',
      description: 'Remove a memory that is wrong or no longer true.',
      inputSchema: { id: z.uuid() },
      annotations: { destructiveHint: true },
      handler: async ({ id }) => {
        await db.deleteMemory(id);
        return { deleted: id };
      },
    }),
  ];
}
