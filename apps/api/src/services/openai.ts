import OpenAI from 'openai';
import { config } from '../config.js';
import type {
  ChatRequest,
  ChatResponse,
  CoachAction,
  CoachDebugErrorStage,
  JsonValue,
} from '@habits-coach/shared';

const client = new OpenAI({
  apiKey: config.openai.apiKey,
});

// GPT-5.x models require max_completion_tokens, older models use max_tokens
export function getTokenLimitParam(limit: number): { max_tokens: number } | { max_completion_tokens: number } {
  if (config.openai.model.startsWith('gpt-5')) {
    return { max_completion_tokens: limit };
  }
  return { max_tokens: limit };
}

function assertStructuredOutputsSupported(model: string): void {
  if (!/^(gpt-4o|gpt-4\.1|gpt-5|o[1-9]|o3|o4)/.test(model)) {
    throw new Error(
      `Coach chat requires a model with structured outputs support. Configured model "${model}" is not supported.`
    );
  }
}

const PRIORITY_VALUES = [1, 2, 3, 4] as const;
const GOAL_STATUS_VALUES = ['active', 'paused', 'completed', 'archived'] as const;
const HABIT_FREQUENCY_VALUES = ['daily', 'weekly'] as const;
const HABIT_TIME_OF_DAY_VALUES = ['morning', 'afternoon', 'evening', 'anytime'] as const;
const HABIT_WEEKDAY_VALUES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAILY_PLAN_ITEM_TYPE_VALUES = ['habit', 'todo', 'note'] as const;

type JsonSchema = Record<string, unknown>;

const NULL_SCHEMA = { type: 'null' } as const;
const STRING_SCHEMA = { type: 'string' } as const;
const INTEGER_SCHEMA = { type: 'integer' } as const;
const BOOLEAN_SCHEMA = { type: 'boolean' } as const;

function enumSchema<T extends readonly (string | number)[]>(values: T): JsonSchema {
  return {
    type: typeof values[0] === 'number' ? 'integer' : 'string',
    enum: [...values],
  };
}

function arraySchema(items: JsonSchema): JsonSchema {
  return {
    type: 'array',
    items,
  };
}

function nullableSchema(schema: JsonSchema): JsonSchema {
  return {
    anyOf: [schema, NULL_SCHEMA],
  };
}

function strictObjectSchema(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const goalDraftAddSchema = strictObjectSchema({
  title: STRING_SCHEMA,
  description: nullableSchema(STRING_SCHEMA),
  status: nullableSchema(enumSchema(GOAL_STATUS_VALUES)),
  priority: nullableSchema(enumSchema(PRIORITY_VALUES)),
  targetDate: nullableSchema(STRING_SCHEMA),
});

const goalDraftChangesSchema = strictObjectSchema({
  title: nullableSchema(STRING_SCHEMA),
  description: nullableSchema(STRING_SCHEMA),
  status: nullableSchema(enumSchema(GOAL_STATUS_VALUES)),
  priority: nullableSchema(enumSchema(PRIORITY_VALUES)),
  targetDate: nullableSchema(STRING_SCHEMA),
});

const habitDraftCreateSchema = strictObjectSchema({
  name: STRING_SCHEMA,
  frequency: enumSchema(HABIT_FREQUENCY_VALUES),
  weeklyDays: nullableSchema(arraySchema(enumSchema(HABIT_WEEKDAY_VALUES))),
  weeklyCount: nullableSchema(INTEGER_SCHEMA),
  timeOfDay: nullableSchema(enumSchema(HABIT_TIME_OF_DAY_VALUES)),
  reason: nullableSchema(STRING_SCHEMA),
  icon: nullableSchema(STRING_SCHEMA),
});

const habitDraftChangesSchema = strictObjectSchema({
  name: nullableSchema(STRING_SCHEMA),
  frequency: nullableSchema(enumSchema(HABIT_FREQUENCY_VALUES)),
  weeklyDays: nullableSchema(arraySchema(enumSchema(HABIT_WEEKDAY_VALUES))),
  weeklyCount: nullableSchema(INTEGER_SCHEMA),
  timeOfDay: nullableSchema(enumSchema(HABIT_TIME_OF_DAY_VALUES)),
  reason: nullableSchema(STRING_SCHEMA),
  icon: nullableSchema(STRING_SCHEMA),
});

const todoDraftAddSchema = strictObjectSchema({
  title: STRING_SCHEMA,
  notes: nullableSchema(STRING_SCHEMA),
  priority: nullableSchema(enumSchema(PRIORITY_VALUES)),
  dueDate: nullableSchema(STRING_SCHEMA),
  scheduledDate: nullableSchema(STRING_SCHEMA),
  scheduledTime: nullableSchema(STRING_SCHEMA),
  estimateMinutes: nullableSchema(INTEGER_SCHEMA),
  listId: nullableSchema(STRING_SCHEMA),
  listName: nullableSchema(STRING_SCHEMA),
  goalId: nullableSchema(STRING_SCHEMA),
  tagIds: nullableSchema(arraySchema(STRING_SCHEMA)),
  tagNames: nullableSchema(arraySchema(STRING_SCHEMA)),
});

const todoDraftChangesSchema = strictObjectSchema({
  title: nullableSchema(STRING_SCHEMA),
  notes: nullableSchema(STRING_SCHEMA),
  priority: nullableSchema(enumSchema(PRIORITY_VALUES)),
  dueDate: nullableSchema(STRING_SCHEMA),
  scheduledDate: nullableSchema(STRING_SCHEMA),
  scheduledTime: nullableSchema(STRING_SCHEMA),
  estimateMinutes: nullableSchema(INTEGER_SCHEMA),
  listId: nullableSchema(STRING_SCHEMA),
  listName: nullableSchema(STRING_SCHEMA),
  goalId: nullableSchema(STRING_SCHEMA),
  tagIds: nullableSchema(arraySchema(STRING_SCHEMA)),
  tagNames: nullableSchema(arraySchema(STRING_SCHEMA)),
});

const dailyPlanItemRefSchema = {
  anyOf: [
    strictObjectSchema({
      kind: enumSchema(['habit'] as const),
      id: STRING_SCHEMA,
    }),
    strictObjectSchema({
      kind: enumSchema(['todo'] as const),
      id: STRING_SCHEMA,
    }),
    strictObjectSchema({
      kind: enumSchema(['action'] as const),
      clientKey: STRING_SCHEMA,
    }),
  ],
} as const;

const dailyPlanDraftItemSchema = strictObjectSchema({
  itemType: enumSchema(DAILY_PLAN_ITEM_TYPE_VALUES),
  ref: nullableSchema(dailyPlanItemRefSchema),
  title: STRING_SCHEMA,
  notes: nullableSchema(STRING_SCHEMA),
  scheduledTime: STRING_SCHEMA,
  estimateMinutes: nullableSchema(INTEGER_SCHEMA),
  isOptional: nullableSchema(BOOLEAN_SCHEMA),
});

const dailyPlanDraftSchema = strictObjectSchema({
  date: STRING_SCHEMA,
  rationale: nullableSchema(STRING_SCHEMA),
  items: arraySchema(dailyPlanDraftItemSchema),
});

const coachActionSchema = {
  anyOf: [
    strictObjectSchema({
      entity: enumSchema(['goal'] as const),
      operation: enumSchema(['add'] as const),
      clientKey: nullableSchema(STRING_SCHEMA),
      goal: goalDraftAddSchema,
    }),
    strictObjectSchema({
      entity: enumSchema(['goal'] as const),
      operation: enumSchema(['edit'] as const),
      goalId: STRING_SCHEMA,
      changes: goalDraftChangesSchema,
    }),
    strictObjectSchema({
      entity: enumSchema(['goal'] as const),
      operation: enumSchema(['archive'] as const),
      goalId: STRING_SCHEMA,
    }),
    strictObjectSchema({
      entity: enumSchema(['habit'] as const),
      operation: enumSchema(['create'] as const),
      clientKey: nullableSchema(STRING_SCHEMA),
      habit: habitDraftCreateSchema,
    }),
    strictObjectSchema({
      entity: enumSchema(['habit'] as const),
      operation: enumSchema(['expand', 'contract'] as const),
      habitId: STRING_SCHEMA,
      changes: habitDraftChangesSchema,
    }),
    strictObjectSchema({
      entity: enumSchema(['habit'] as const),
      operation: enumSchema(['archive'] as const),
      habitId: STRING_SCHEMA,
    }),
    strictObjectSchema({
      entity: enumSchema(['todo'] as const),
      operation: enumSchema(['add'] as const),
      clientKey: nullableSchema(STRING_SCHEMA),
      todo: todoDraftAddSchema,
    }),
    strictObjectSchema({
      entity: enumSchema(['todo'] as const),
      operation: enumSchema(['edit'] as const),
      todoId: STRING_SCHEMA,
      changes: todoDraftChangesSchema,
    }),
    strictObjectSchema({
      entity: enumSchema(['todo'] as const),
      operation: enumSchema(['schedule'] as const),
      todoId: STRING_SCHEMA,
      scheduledDate: STRING_SCHEMA,
      scheduledTime: nullableSchema(STRING_SCHEMA),
    }),
    strictObjectSchema({
      entity: enumSchema(['todo'] as const),
      operation: enumSchema(['unschedule'] as const),
      todoId: STRING_SCHEMA,
    }),
    strictObjectSchema({
      entity: enumSchema(['todo'] as const),
      operation: enumSchema(['complete', 'cancel', 'reopen', 'remove'] as const),
      todoId: STRING_SCHEMA,
    }),
  ],
} as const;

const chatProposalSchema = strictObjectSchema({
  actions: arraySchema(coachActionSchema),
  dailyPlanDraft: nullableSchema(dailyPlanDraftSchema),
});

const chatResponseSchema = strictObjectSchema({
  message: STRING_SCHEMA,
  proposal: nullableSchema(chatProposalSchema),
});

function getChatResponseFormat() {
  assertStructuredOutputsSupported(config.openai.model);

  return {
    type: 'json_schema',
    json_schema: {
      name: 'coach_chat_response',
      strict: true,
      schema: chatResponseSchema,
    },
  } as const;
}

const SYSTEM_PROMPT = `You are Habitron, a warm, thoughtful coach for personal planning and behavior change.

You reason over five domains:
1. Goals
2. Habits
3. Tasks
4. Journal entries
5. Daily plans

## Style
- Be warm, specific, and honest.
- Ask clarifying questions when context is thin.
- Do not assume the user's first instinct is automatically the right intervention.
- When the user explicitly asks for planning, you may propose concrete actions and a daily plan.
- Keep plans realistic. Prefer a focused day over an overloaded one.
- Use journal context, recent commitments, and current workload to infer capacity.

## What You Can Propose
- Goal changes: add, edit, archive
- Habit changes: create, expand, contract, archive
- Task changes: add, edit, schedule, unschedule, complete, cancel, reopen, remove
- Journal capture: create
- Daily plan draft with concrete scheduled times

## Proposal Rules
- Only include a proposal when you have enough context to justify it.
- Batch related changes inside a single proposal.
- If the user gives an explicit operational instruction such as "archive this habit", "make it three times a week", or "add this task", you may propose the matching change immediately.
- If the user is expressing uncertainty, frustration, resistance, doubt, or a vague desire to stop/change something, do not jump straight to an operation. Ask one brief diagnostic follow-up first and keep \`proposal\` as null.
- That first follow-up should be diagnostic, not a menu of operations. Try to learn what changed, what friction exists, whether the underlying goal still matters, and whether the issue is temporary or structural.
- After that diagnostic turn, propose the intervention you think is best. It may support, soften, redirect, or challenge the user's first instinct.
- Do not ask the user to choose between operations like create / contract / archive before you understand the situation.
- If a daily plan draft includes a brand-new task or habit created in the same proposal, give the create action a unique \`clientKey\` and reference it from the plan item using \`{ "kind": "action", "clientKey": "..." }\`.
- Use existing entity IDs whenever you are editing, expanding, contracting, or archiving something that already exists.
- Do not fabricate IDs.
- Do not include multiple actions against the same existing entity in a single proposal.
- Treat habit management as a distinct skill:
  - Use \`create\` to propose a brand-new habit.
  - Use \`expand\` to make an existing habit larger, more ambitious, or more frequent when it is going well.
  - Use \`contract\` to make an existing habit smaller, easier, or narrower when the current version is not sticking.
  - Use \`archive\` to deactivate a habit that is no longer useful right now.
- When the user is asking to start, add, or set up a habit, use \`create\` unless they are clearly modifying an existing habit.
- Never use \`archive\` unless the user is clearly asking to stop, remove, drop, or deactivate an existing habit.
- If the user says something like "I don't want to do this anymore" or "this isn't working" without giving an explicit instruction, treat that as a coaching signal to understand first, not an automatic archive command.
- For \`expand\` and \`contract\`, use \`habitId\` plus \`changes\` and only include fields that should change.
- Do not create journal entries or memory-capture side effects as part of a habit-management proposal.
- The conversational message must match the structured proposal you return.
- Never invent alternate field names. Follow the app schema exactly.
- For habit creation, the habit payload uses \`name\`, \`frequency\`, optional \`timeOfDay\`, optional \`reason\`, optional \`icon\`.
- Do not use \`title\`, \`time\`, or \`notes\` inside a habit payload.
- A daily plan should usually contain 3-8 items total and at least one focus item.
- Mark clearly non-essential items as \`isOptional: true\`.
- For task \`scheduledTime\`, use a 24-hour \`HH:MM\` string like \`09:30\`.
- For \`dailyPlanDraft.items[].scheduledTime\`, use a 24-hour \`HH:MM\` string like \`09:30\`.

## Response Format
Always return valid JSON in this exact shape:
{
  "message": "Your conversational response",
  "proposal": null
}

Or with changes:
{
  "message": "Your conversational response",
  "proposal": {
    "actions": [
      {
        "entity": "habit",
        "operation": "create",
        "clientKey": "habit-creatine",
        "habit": {
          "name": "Take creatine",
          "frequency": "daily",
          "timeOfDay": "anytime",
          "reason": "Support your 90kg strength and body composition goal"
        }
      },
      {
        "entity": "todo",
        "operation": "add",
        "clientKey": "task-1",
        "todo": {
          "title": "Send invoice",
          "notes": "Follow up with Acme",
          "listName": "Work",
          "tagNames": ["admin"],
          "priority": 2,
          "scheduledDate": "2026-03-24",
          "scheduledTime": "09:30",
          "estimateMinutes": 20
        }
      }
    ],
    "dailyPlanDraft": {
      "date": "2026-03-24",
      "rationale": "Short reason for the plan",
      "items": [
        {
          "itemType": "todo",
          "ref": { "kind": "action", "clientKey": "task-1" },
          "title": "Send invoice",
          "scheduledTime": "09:30",
          "estimateMinutes": 20
        }
      ]
    }
  }
}

If no structured changes are needed, keep "proposal" as null.`;

function buildUserContext(request: ChatRequest): string {
  const nameContext = request.userName
    ? `The user's name is ${request.userName}. Use their name naturally.\n\n`
    : '';

  const todayContext = request.today
    ? `Today is ${request.today}${request.timezone ? ` in timezone ${request.timezone}` : ''}.\n\n`
    : '';

  return `${nameContext}${todayContext}You are helping a user manage their real life, not an abstract productivity game. Use all available structured context before you suggest changes.`;
}

function buildGoalsContext(goals: NonNullable<ChatRequest['goals']>): string {
  if (goals.length === 0) {
    return '## Goals\n- No goals tracked yet.';
  }

  return `## Goals\n${goals
    .map((goal) => {
      const details = [
        goal.status,
        goal.priority ? `priority ${goal.priority}` : null,
        goal.targetDate ? `target ${goal.targetDate}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      return `- "${goal.title}" [id: ${goal.id}]${details ? ` (${details})` : ''}${goal.description ? ` - ${goal.description}` : ''}`;
    })
    .join('\n')}`;
}

function buildHabitsContext(habits: ChatRequest['habits']): string {
  if (habits.length === 0) {
    return '## Habits\n- No habits tracked yet.';
  }

  return `## Habits\n${habits
    .map(
      (habit) =>
        `- "${habit.name}" [id: ${habit.id}] (${habit.frequency}, ${habit.timeOfDay || 'anytime'})${habit.reason ? ` - ${habit.reason}` : ''}`
    )
    .join('\n')}`;
}

function buildTodosContext(todos: NonNullable<ChatRequest['todos']>): string {
  if (todos.length === 0) {
    return '## Tasks\n- No tasks tracked yet.';
  }

  return `## Tasks\n${todos
    .map((todo) => {
      const details = [
        todo.status,
        todo.priority ? `priority ${todo.priority}` : null,
        todo.dueDate ? `due ${todo.dueDate}` : null,
        todo.scheduledDate ? `scheduled ${todo.scheduledDate}` : null,
        todo.scheduledTime ? `at ${todo.scheduledTime}` : null,
        todo.tags.length > 0 ? `tags ${todo.tags.map((tag) => tag.name).join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      return `- "${todo.title}" [id: ${todo.id}]${details ? ` (${details})` : ''}${todo.notes ? ` - ${todo.notes}` : ''}`;
    })
    .join('\n')}`;
}

function buildJournalContext(entries: NonNullable<ChatRequest['journalEntries']>): string {
  if (entries.length === 0) {
    return '## Journal\n- No journal entries captured yet.';
  }

  return `## Journal\n${entries
    .slice(0, 6)
    .map((entry) => {
      const details = entry.mood ? `mood ${entry.mood}` : '';

      return `- ${entry.entryDate}${details ? ` (${details})` : ''}: ${entry.content}`;
    })
    .join('\n')}`;
}

function buildDailyPlanContext(plan?: ChatRequest['dailyPlan'] | null): string {
  if (!plan) {
    return '## Active Daily Plan\n- No saved daily plan.';
  }

  const itemLines = plan.items.map((item) => {
    const details = [`at ${item.scheduledTime}`, item.outcome]
      .filter(Boolean)
      .join(', ');

    return `  - ${item.titleSnapshot}${details ? ` (${details})` : ''}`;
  });

  return `## Active Daily Plan\n- Date: ${plan.planDate}\n- Status: ${plan.status}\n${itemLines.join('\n')}`;
}

function buildMemoryContext(memories?: ChatRequest['memories']): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  const memoryList = memories.map((m) => `- [${m.category}] ${m.content}`).join('\n');

  return `\n\n## What you know about this user (from previous sessions):\n${memoryList}\n\nUse this context to personalize your coaching naturally. Don't explicitly say "I remember" - just incorporate what you know into your responses.`;
}

function buildConversationContext(
  messages: ChatRequest['messages']
): string {
  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  return `## Conversation State
- Messages exchanged: ${userMessageCount}
- Use your judgment to determine if you understand their situation well enough to propose a useful next step or a realistic plan.`;
}

function buildMessages(
  request: ChatRequest
): OpenAI.ChatCompletionMessageParam[] {
  const memoryContext = buildMemoryContext(request.memories);
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT + memoryContext },
    { role: 'system', content: buildUserContext(request) },
    {
      role: 'system',
      content: [
        buildGoalsContext(request.goals ?? []),
        buildHabitsContext(request.habits),
        buildTodosContext(request.todos ?? []),
        buildJournalContext(request.journalEntries ?? []),
        buildDailyPlanContext(request.dailyPlan),
      ].join('\n\n'),
    },
    { role: 'system', content: buildConversationContext(request.messages) },
  ];

  for (const msg of request.messages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return messages;
}

export interface GeneratedChatResponse {
  rawContent: string;
  rawResponse: JsonValue;
  response: ChatResponse;
}

export class CoachChatError extends Error {
  constructor(
    message: string,
    public stage: Extract<
      CoachDebugErrorStage,
      'chat_generation' | 'chat_response_parse' | 'chat_response_validation'
    >,
    public code?: string,
    public metadata?: JsonValue
  ) {
    super(message);
    this.name = 'CoachChatError';
  }
}

export async function generateChatResponse(
  request: ChatRequest
): Promise<GeneratedChatResponse> {
  const messages = buildMessages(request);

  let response: OpenAI.Chat.Completions.ChatCompletion;
  try {
    response = await client.chat.completions.create({
      model: config.openai.model,
      messages,
      response_format: getChatResponseFormat(),
      temperature: 0.7,
      ...getTokenLimitParam(500),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate AI response';
    throw new CoachChatError(message, 'chat_generation');
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new CoachChatError('No response from AI', 'chat_generation', 'empty_response');
  }

  let rawResponse: JsonValue;
  try {
    rawResponse = JSON.parse(content) as JsonValue;
  } catch {
    throw new CoachChatError(
      'Failed to parse AI response',
      'chat_response_parse',
      undefined,
      { rawContent: content }
    );
  }

  const parsed = rawResponse as unknown as ChatResponse;

  // Validate the response structure
  if (typeof parsed.message !== 'string') {
    throw new CoachChatError(
      'Invalid response format: missing message',
      'chat_response_validation',
      undefined,
      { rawContent: content, rawResponse }
    );
  }

  let normalizedProposal: ChatResponse['proposal'];
  try {
    normalizedProposal = normalizeProposal(parsed.proposal, request, parsed.message);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Invalid response format: failed to normalize proposal';
    throw new CoachChatError(
      message,
      'chat_response_validation',
      undefined,
      { rawContent: content, rawResponse }
    );
  }

  return {
    rawContent: content,
    rawResponse,
    response: {
      ...parsed,
      proposal: normalizedProposal,
    },
  };
}

export async function sendMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const generated = await generateChatResponse(request);
  return generated.response;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripNullProperties<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripNullProperties(item)) as T;
  }

  if (isJsonObject(value)) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== null)
      .map(([key, entryValue]) => [key, stripNullProperties(entryValue)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHabitFrequency(value: unknown): value is 'daily' | 'weekly' {
  return value === 'daily' || value === 'weekly';
}

function validateCoachAction(action: unknown): CoachAction {
  const normalizedAction = stripNullProperties(action);

  if (!isJsonObject(normalizedAction)) {
    throw new Error('Invalid response format: action must be an object');
  }

  if (!isNonEmptyString(normalizedAction.entity) || !isNonEmptyString(normalizedAction.operation)) {
    throw new Error('Invalid response format: action must include entity and operation');
  }

  const isSupportedAction =
    (normalizedAction.entity === 'goal' &&
      ['add', 'edit', 'archive'].includes(normalizedAction.operation)) ||
    (normalizedAction.entity === 'habit' &&
      ['create', 'expand', 'contract', 'archive'].includes(normalizedAction.operation)) ||
    (normalizedAction.entity === 'todo' &&
      ['add', 'edit', 'schedule', 'unschedule', 'complete', 'cancel', 'reopen', 'remove'].includes(
        normalizedAction.operation
      ));

  if (!isSupportedAction) {
    throw new Error(
      `Invalid response format: unsupported action ${normalizedAction.entity}:${normalizedAction.operation}`
    );
  }

  if (normalizedAction.entity === 'goal' && normalizedAction.operation === 'add') {
    if (!isJsonObject(normalizedAction.goal) || !isNonEmptyString(normalizedAction.goal.title)) {
      throw new Error('Invalid response format: goal add action must include a title');
    }
  }

  if (
    normalizedAction.entity === 'goal' &&
    (normalizedAction.operation === 'edit' || normalizedAction.operation === 'archive') &&
    !isNonEmptyString(normalizedAction.goalId)
  ) {
    throw new Error(`Invalid response format: goal ${normalizedAction.operation} action must include a goalId`);
  }

  if (normalizedAction.entity === 'habit') {
    if (normalizedAction.operation === 'create') {
      if (!isJsonObject(normalizedAction.habit)) {
        throw new Error('Invalid response format: habit create action must include a habit payload');
      }

      if (!isNonEmptyString(normalizedAction.habit.name)) {
        throw new Error('Invalid response format: habit create action must include a name');
      }

      if (!isHabitFrequency(normalizedAction.habit.frequency)) {
        throw new Error('Invalid response format: habit create action must include a valid frequency');
      }
    }

    if (
      (normalizedAction.operation === 'expand' ||
        normalizedAction.operation === 'contract' ||
        normalizedAction.operation === 'archive') &&
      !isNonEmptyString(normalizedAction.habitId)
    ) {
      throw new Error(`Invalid response format: habit ${normalizedAction.operation} action must include a habitId`);
    }
  }

  if (normalizedAction.entity === 'todo') {
    if (normalizedAction.operation === 'add') {
      if (!isJsonObject(normalizedAction.todo) || !isNonEmptyString(normalizedAction.todo.title)) {
        throw new Error('Invalid response format: task add action must include a title');
      }
    }

    if (
      (normalizedAction.operation === 'edit' ||
        normalizedAction.operation === 'schedule' ||
        normalizedAction.operation === 'unschedule' ||
        normalizedAction.operation === 'complete' ||
        normalizedAction.operation === 'cancel' ||
        normalizedAction.operation === 'reopen' ||
        normalizedAction.operation === 'remove') &&
      !isNonEmptyString(normalizedAction.todoId)
    ) {
      throw new Error(`Invalid response format: task ${normalizedAction.operation} action must include a todoId`);
    }
  }

  return normalizedAction as CoachAction;
}

function assertEntityIdsExist(
  proposal: NonNullable<ChatResponse['proposal']>,
  request: ChatRequest
): NonNullable<ChatResponse['proposal']> {
  const goalIds = new Set((request.goals ?? []).map((goal) => goal.id));
  const habitIds = new Set(request.habits.map((habit) => habit.id));
  const todoIds = new Set((request.todos ?? []).map((todo) => todo.id));

  for (const action of proposal.actions) {
    if (
      action.entity === 'goal' &&
      (action.operation === 'edit' || action.operation === 'archive') &&
      !goalIds.has(action.goalId)
    ) {
      throw new Error(`Invalid response format: goal ${action.operation} action references an unknown goalId`);
    }

    if (
      action.entity === 'habit' &&
      (action.operation === 'expand' ||
        action.operation === 'contract' ||
        action.operation === 'archive') &&
      !habitIds.has(action.habitId)
    ) {
      throw new Error(`Invalid response format: habit ${action.operation} action references an unknown habitId`);
    }

    if (
      action.entity === 'todo' &&
      action.operation !== 'add' &&
      !todoIds.has(action.todoId)
    ) {
      throw new Error(`Invalid response format: task ${action.operation} action references an unknown todoId`);
    }
  }

  return proposal;
}

function assertNoDuplicateEntityActions(
  proposal: NonNullable<ChatResponse['proposal']>
): NonNullable<ChatResponse['proposal']> {
  const seenClientKeys = new Set<string>();
  const seenTargets = new Set<string>();

  for (const action of proposal.actions) {
    const clientKey = 'clientKey' in action ? action.clientKey : undefined;

    if (clientKey) {
      if (seenClientKeys.has(clientKey)) {
        throw new Error('Invalid response format: proposal reuses a clientKey');
      }

      seenClientKeys.add(clientKey);
    }

    let targetKey: string | null = null;

    if (action.entity === 'goal' && action.operation !== 'add') {
      targetKey = `goal:${action.goalId}`;
    }

    if (action.entity === 'habit' && action.operation !== 'create') {
      targetKey = `habit:${action.habitId}`;
    }

    if (action.entity === 'todo' && action.operation !== 'add') {
      targetKey = `todo:${action.todoId}`;
    }

    if (!targetKey) {
      continue;
    }

    if (seenTargets.has(targetKey)) {
      throw new Error(`Invalid response format: proposal includes multiple changes for ${targetKey}`);
    }

    seenTargets.add(targetKey);
  }

  return proposal;
}

function mentionsCreateHabit(message: string): boolean {
  return /\b(create|add|start|set up)\b(?:\s+\w+){0,6}\s+\bhabit\b/i.test(message)
    || /\bhabit\b(?:\s+\w+){0,6}\s+\b(create|add|start|set up)\b/i.test(message);
}

function mentionsArchiveHabit(message: string): boolean {
  return /\b(archive|stop|remove|drop|deactivate)\b(?:\s+\w+){0,6}\s+\bhabit\b/i.test(message)
    || /\bhabit\b(?:\s+\w+){0,6}\s+\b(archive|stop|remove|drop|deactivate)\b/i.test(message);
}

function assertProposalMatchesMessage(
  message: string,
  proposal: NonNullable<ChatResponse['proposal']>
): NonNullable<ChatResponse['proposal']> {
  if (proposal.actions.length !== 1) {
    return proposal;
  }

  const [action] = proposal.actions;
  if (action.entity !== 'habit') {
    return proposal;
  }

  if (action.operation === 'archive' && mentionsCreateHabit(message)) {
    throw new Error(
      'Invalid response format: assistant message describes creating a habit but proposal archives one'
    );
  }

  if (action.operation === 'create' && mentionsArchiveHabit(message)) {
    throw new Error(
      'Invalid response format: assistant message describes archiving a habit but proposal creates one'
    );
  }

  return proposal;
}

function normalizeProposal(
  proposal: ChatResponse['proposal'],
  request: ChatRequest,
  message: string
): ChatResponse['proposal'] {
  if (proposal === undefined || proposal === null) {
    return proposal;
  }

  const normalizedProposal = stripNullProperties(proposal);

  if (!isJsonObject(normalizedProposal)) {
    throw new Error('Invalid response format: proposal must be an object');
  }

  const rawActions = normalizedProposal.actions;

  if (rawActions === undefined || rawActions === null) {
    return {
      ...normalizedProposal,
      actions: [],
    } as NonNullable<ChatResponse['proposal']>;
  }

  if (Array.isArray(rawActions)) {
    return assertProposalMatchesMessage(
      message,
      assertNoDuplicateEntityActions(
        assertEntityIdsExist({
          ...normalizedProposal,
          actions: rawActions.map(validateCoachAction),
        } as NonNullable<ChatResponse['proposal']>, request)
      )
    );
  }

  return assertProposalMatchesMessage(
    message,
    assertNoDuplicateEntityActions(
      assertEntityIdsExist({
        ...normalizedProposal,
        actions: [validateCoachAction(rawActions)],
      } as NonNullable<ChatResponse['proposal']>, request)
    )
  );
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  // Determine file extension from mime type
  const extensionMap: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/webm': 'webm',
  };

  const extension = extensionMap[mimeType] || 'wav';

  // Create a File object from the buffer
  // Convert Buffer to Uint8Array for compatibility with File constructor
  const uint8Array = new Uint8Array(audioBuffer);
  const file = new File([uint8Array], `audio.${extension}`, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file: file,
  });

  return response.text;
}
