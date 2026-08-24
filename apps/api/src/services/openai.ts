import OpenAI from 'openai';
import { config } from '../config.js';
import type {
  ChatRequest,
  ChatResponse,
  CoachAction,
  DailyPlanDraft,
  DailyPlanDraftItem,
  DailyPlanDraftItemRef,
} from '@habits-coach/shared';
import { getCoachSkillDefinition } from '../coach/registry.js';
import { inferCoachSkillId } from '../coach/router.js';
import {
  resolveCoachRuntimeContext,
  syncCoachRuntimeAfterResponse,
  type CoachRuntimeContext,
} from '../coach/runtime.js';
import {
  executeCoachTaskToolCall,
  getCoachTaskOverview,
  getCoachTaskToolDefinitions,
  resolveCoachTaskMap,
  type CoachTaskOverview,
} from './coachTaskTools.js';

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

const COACH_ORCHESTRATOR_PROMPT = `You are Habitron, a warm, thoughtful coach for personal planning and behavior change.

You operate through specialized coaching skills. For every turn, follow the active skill instructions as the primary behavior policy.

You reason over five domains:
1. Goals
2. Habits
3. Tasks
4. Journal entries
5. Daily plans

## Style
- Be warm, specific, and honest.
- Ask clarifying questions when context is thin.
- Keep suggestions realistic. Prefer clarity and grounded tradeoffs over hype.
- Treat the user like a person living a real day, not a productivity game.

## What You Can Propose
- Goal changes: add, edit, archive
- Habit changes: add, edit, archive
- Task changes: add, edit, schedule, unschedule, complete, cancel, reopen, remove
- Journal capture: create
- Daily plan draft with explicit scheduled times

## Proposal Rules
- Only include a proposal when you have enough context to justify it.
- Batch related changes inside a single proposal.
- When live task tools are available, use them to inspect the current task system instead of guessing from stale transcript context.
- If a daily plan draft includes a brand-new task or habit created in the same proposal, give the create action a unique \`clientKey\` and reference it from the plan item using \`{ "kind": "action", "clientKey": "..." }\`.
- Every \`dailyPlanDraft\` item with \`itemType: "todo"\` or \`itemType: "habit"\` must point to a real existing entity via \`ref\`, or to a matching add action via \`clientKey\`. If it is just guidance text, use \`itemType: "note"\`.
- Use existing entity IDs whenever you are editing or removing something that already exists.
- Do not fabricate IDs.
- If the active skill is still gathering context, keep \`proposal\` as \`null\`.
- A daily plan should usually contain 3-8 items total and at least one focus item.
- Mark clearly non-essential items as \`isOptional: true\`.
- For task \`scheduledTime\`, use a 24-hour \`HH:MM\` string like \`09:30\`.

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
        "entity": "todo",
        "operation": "add",
        "clientKey": "task-1",
        "todo": {
          "title": "Send invoice",
          "notes": "Follow up with Acme",
          "listName": "Work",
          "tagName": "admin",
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
        `- "${habit.name}" [id: ${habit.id}] (${habit.frequency})${habit.reason ? ` - ${habit.reason}` : ''}`
    )
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

function buildGoalsSummaryContext(goals: NonNullable<ChatRequest['goals']>): string {
  const activeGoals = goals.filter((goal) => goal.status === 'active').length;
  return `## Goals Summary\n- Total goals: ${goals.length}\n- Active goals: ${activeGoals}`;
}

function buildHabitsSummaryContext(habits: ChatRequest['habits']): string {
  const activeHabits = habits.filter((habit) => habit.active).length;
  return `## Habits Summary\n- Total habits: ${habits.length}\n- Active habits: ${activeHabits}`;
}

function formatCoachTaskLine(task: CoachTaskOverview['sampleOpenTasks'][number]): string {
  const details = [
    `id ${task.id}`,
    task.priority ? `priority ${task.priority}` : null,
    task.dueDate ? `due ${task.dueDate}` : null,
    task.scheduledDate ? `scheduled ${task.scheduledDate}` : null,
    task.scheduledTime ? `at ${task.scheduledTime}` : null,
    task.estimateMinutes ? `est ${task.estimateMinutes}m` : null,
    task.actualMinutes ? `actual ${task.actualMinutes}m` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return `- "${task.title}"${details ? ` (${details})` : ''}`;
}

function buildTaskOverviewContext(taskOverview?: CoachTaskOverview | null): string {
  if (!taskOverview) {
    return '## Task Overview Snapshot\n- Live task tools are not available in this turn.';
  }

  const sampleTaskLines = taskOverview.sampleOpenTasks.length > 0
    ? taskOverview.sampleOpenTasks.map(formatCoachTaskLine)
    : ['- No open task samples available.'];

  return [
    '## Task Overview Snapshot',
    `- Total tasks: ${taskOverview.totalTasks}`,
    `- Open tasks: ${taskOverview.openTasks}`,
    `- Completed tasks: ${taskOverview.completedTasks}`,
    `- Canceled tasks: ${taskOverview.canceledTasks}`,
    `- Scheduled today: ${taskOverview.scheduledTodayOpenTasks}`,
    `- Unscheduled open tasks: ${taskOverview.unscheduledOpenTasks}`,
    `- Overdue open tasks: ${taskOverview.overdueOpenTasks}`,
    `- Duplicate open-title groups: ${taskOverview.duplicateOpenTitleGroups}`,
    '',
    '### Sample Open Tasks',
    ...sampleTaskLines,
  ].join('\n');
}

function buildTaskToolingContext(
  leadSkillId: CoachRuntimeContext['leadSkillId'],
  taskToolsEnabled: boolean
): string {
  if (!taskToolsEnabled) {
    return '## Task Tools\n- Live task query tools are not available in this turn.';
  }

  const leadInstruction =
    leadSkillId === 'task-management'
      ? '- Before proposing edits, removals, or duplicate cleanup for existing tasks, inspect the exact current tasks with tools in this turn.'
      : leadSkillId === 'habit-design'
        ? '- Use task tools to gauge current load before proposing a new or bigger habit. Do not drift into task cleanup unless the user asks for it.'
      : '- Use task tools to inspect likely task candidates before drafting or revising the day.';

  return [
    '## Task Tools',
    '- Live task query tools are available in this conversation.',
    '- Prefer task tools over long remembered task lists when you need specifics.',
    leadInstruction,
  ].join('\n');
}

function buildMemoryContext(memories?: ChatRequest['memories']): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  const memoryList = memories.map((m) => `- [${m.category}] ${m.content}`).join('\n');

  return `\n\n## What you know about this user (from previous sessions):\n${memoryList}\n\nUse this context to personalize your coaching naturally. Don't explicitly say "I remember" - just incorporate what you know into your responses.`;
}

function buildActiveSkillContext(skillId: CoachRuntimeContext['leadSkillId']): string {
  const skill = getCoachSkillDefinition(skillId);

  return [
    '## Active Coaching Skill',
    `- id: ${skill.id}`,
    `- label: ${skill.label}`,
    `- description: ${skill.description}`,
    '',
    skill.instructions,
  ].join('\n');
}

function formatSkillStateValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildSessionSkillStateContext(runtimeContext: CoachRuntimeContext): string {
  if (runtimeContext.activeSkills.length === 0) {
    return '## Session Skill State\n- No persisted specialist skills are active in this session.';
  }

  const activeSkillLines = runtimeContext.activeSkills.map((skill) => {
    const details = [
      skill.status,
      skill.phase ? `phase ${skill.phase}` : null,
      skill.isLead ? 'lead' : null,
    ]
      .filter(Boolean)
      .join(', ');

    return `- ${skill.skillId}${details ? ` (${details})` : ''}`;
  });

  const leadStateLines = Object.entries(runtimeContext.leadSkill?.state ?? {})
    .slice(0, 6)
    .map(([key, value]) => `- ${key}: ${formatSkillStateValue(value)}`);

  return [
    '## Session Skill State',
    `- Runtime source: ${runtimeContext.source}`,
    `- Lead skill: ${runtimeContext.leadSkillId}`,
    '',
    '### Active Skills',
    ...activeSkillLines,
    ...(leadStateLines.length > 0
      ? ['', '### Lead Skill Working State', ...leadStateLines]
      : []),
  ].join('\n');
}

function buildPlanningPacketContext(
  request: ChatRequest,
  taskOverview?: CoachTaskOverview | null
): string {
  const recentJournalEntries = (request.journalEntries ?? []).slice(0, 3);
  const activeHabits = request.habits.filter((habit) => habit.active);

  const candidateLines = !taskOverview || taskOverview.sampleOpenTasks.length === 0
    ? ['- No open task candidates yet.']
    : taskOverview.sampleOpenTasks.map(formatCoachTaskLine);

  const journalLines = recentJournalEntries.length === 0
    ? ['- No recent journal signal.']
    : recentJournalEntries.map((entry) =>
        `- ${entry.entryDate}${entry.mood ? ` (${entry.mood})` : ''}: ${entry.content}`
      );

  return [
    '## Planning Packet',
    `- Open tasks: ${taskOverview?.openTasks ?? 0}`,
    `- Overdue tasks: ${taskOverview?.overdueOpenTasks ?? 0}`,
    `- Tasks already scheduled for today: ${taskOverview?.scheduledTodayOpenTasks ?? 0}`,
    `- Active habits: ${activeHabits.length}`,
    request.dailyPlan
      ? `- Existing daily plan: ${request.dailyPlan.status} for ${request.dailyPlan.planDate}`
      : '- Existing daily plan: none',
    '',
    '### Candidate Tasks',
    ...candidateLines,
    '',
    '### Recent Journal Signal',
    ...journalLines,
  ].join('\n');
}

function buildConversationContext(
  messages: ChatRequest['messages']
): string {
  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  return `## Conversation State
- Messages exchanged: ${userMessageCount}
- Use your judgment to determine if you understand their situation well enough to propose a useful next step or a realistic plan.`;
}

function buildStructuredDomainContext(
  request: ChatRequest,
  leadSkillId: CoachRuntimeContext['leadSkillId'],
  taskOverview?: CoachTaskOverview | null
): string {
  if (leadSkillId === 'task-management') {
    return [
      buildGoalsSummaryContext(request.goals ?? []),
      buildHabitsSummaryContext(request.habits),
      buildTaskOverviewContext(taskOverview),
      buildDailyPlanContext(request.dailyPlan),
    ].join('\n\n');
  }

  if (leadSkillId === 'day-planning') {
    return [
      buildGoalsContext(request.goals ?? []),
      buildHabitsContext(request.habits),
      buildTaskOverviewContext(taskOverview),
      buildJournalContext(request.journalEntries ?? []),
      buildDailyPlanContext(request.dailyPlan),
    ].join('\n\n');
  }

  return [
    buildGoalsContext(request.goals ?? []),
    buildHabitsContext(request.habits),
    buildTaskOverviewContext(taskOverview),
    buildJournalContext(request.journalEntries ?? []),
    buildDailyPlanContext(request.dailyPlan),
  ].join('\n\n');
}

function buildMessages(
  request: ChatRequest,
  runtimeContext: CoachRuntimeContext,
  options?: {
    taskOverview?: CoachTaskOverview | null;
    taskToolsEnabled?: boolean;
  }
): OpenAI.ChatCompletionMessageParam[] {
  const memoryContext = buildMemoryContext(request.memories);
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: COACH_ORCHESTRATOR_PROMPT + memoryContext },
    { role: 'system', content: buildActiveSkillContext(runtimeContext.leadSkillId) },
    { role: 'system', content: buildSessionSkillStateContext(runtimeContext) },
    { role: 'system', content: buildUserContext(request) },
    {
      role: 'system',
      content: buildTaskToolingContext(
        runtimeContext.leadSkillId,
        Boolean(options?.taskToolsEnabled)
      ),
    },
    {
      role: 'system',
      content: buildStructuredDomainContext(
        request,
        runtimeContext.leadSkillId,
        options?.taskOverview
      ),
    },
    ...(runtimeContext.leadSkillId === 'day-planning'
      ? [
          {
            role: 'system' as const,
            content: buildPlanningPacketContext(request, options?.taskOverview),
          },
        ]
      : []),
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

function supportsTaskTools(
  leadSkillId: CoachRuntimeContext['leadSkillId'],
  request: ChatRequest,
  userId?: string
): boolean {
  return (
    (
      leadSkillId === 'day-planning'
      || leadSkillId === 'task-management'
      || leadSkillId === 'habit-design'
    ) &&
    Boolean(userId || request.todos)
  );
}

async function runCompletionLoop(args: {
  request: ChatRequest;
  messages: OpenAI.ChatCompletionMessageParam[];
  userId?: string;
  taskToolsEnabled: boolean;
}): Promise<string> {
  const tools = args.taskToolsEnabled ? getCoachTaskToolDefinitions() : undefined;
  const workingMessages = [...args.messages];

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: workingMessages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      ...(tools
        ? {
            tools,
            tool_choice: 'auto' as const,
            parallel_tool_calls: false,
          }
        : {}),
      ...getTokenLimitParam(500),
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error('No response from AI');
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      workingMessages.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: message.tool_calls,
      });

      for (const toolCall of message.tool_calls) {
        const result = await executeCoachTaskToolCall({
          toolName: toolCall.function.name,
          rawArguments: toolCall.function.arguments,
          source: {
            userId: args.userId,
            todos: args.request.todos,
          },
          today: args.request.today,
        });

        workingMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      continue;
    }

    if (!message.content) {
      throw new Error('No response from AI');
    }

    return message.content;
  }

  throw new Error('Exceeded task tool loop limit');
}

function parseChatResponseContent(content: string): ChatResponse {
  try {
    return JSON.parse(content) as ChatResponse;
  } catch {
    const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]
      ?? (() => {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        return firstBrace >= 0 && lastBrace > firstBrace
          ? content.slice(firstBrace, lastBrace + 1)
          : null;
      })();

    if (!candidate) {
      throw new SyntaxError('Failed to parse AI response');
    }

    return JSON.parse(candidate) as ChatResponse;
  }
}

interface ProposalGroundingContext {
  validGoalIds: Set<string>;
  validHabitIds: Set<string>;
  validTodoIds: Set<string>;
}

function collectReferencedTodoIds(
  proposal: ChatResponse['proposal']
): string[] {
  if (!proposal || typeof proposal !== 'object') {
    return [];
  }

  const ids = new Set<string>();
  const rawProposal = proposal as unknown as Record<string, unknown>;

  const rawActions = Array.isArray(rawProposal.actions)
    ? rawProposal.actions
    : rawProposal.actions
      ? [rawProposal.actions]
      : [];

  for (const action of rawActions) {
    if (!isRecord(action) || action.entity !== 'todo') {
      continue;
    }

    if (typeof action.todoId === 'string') {
      ids.add(action.todoId);
    }
  }

  if (isRecord(rawProposal.dailyPlanDraft) && Array.isArray(rawProposal.dailyPlanDraft.items)) {
    for (const item of rawProposal.dailyPlanDraft.items) {
      if (!isRecord(item) || !isRecord(item.ref)) {
        continue;
      }

      if (item.ref.kind === 'todo' && typeof item.ref.id === 'string') {
        ids.add(item.ref.id);
      }
    }
  }

  return Array.from(ids);
}

export async function sendMessage(
  request: ChatRequest,
  options?: { userId?: string }
): Promise<ChatResponse> {
  let runtimeContext: CoachRuntimeContext;
  try {
    runtimeContext = await resolveCoachRuntimeContext(options?.userId, request);
  } catch (error) {
    console.error('Failed to resolve coach runtime context:', error);
    runtimeContext = {
      leadSkillId: inferCoachSkillId(request),
      leadSkill: null,
      activeSkills: [],
      source: 'inferred',
    };
  }

  const taskToolsEnabled = supportsTaskTools(
    runtimeContext.leadSkillId,
    request,
    options?.userId
  );
  const taskOverview = taskToolsEnabled
    ? await getCoachTaskOverview({
        userId: options?.userId,
        todos: request.todos,
        today: request.today,
      })
    : null;
  const messages = buildMessages(request, runtimeContext, {
    taskOverview,
    taskToolsEnabled,
  });
  const content = await runCompletionLoop({
    request,
    messages,
    userId: options?.userId,
    taskToolsEnabled,
  });

  const parsed = parseChatResponseContent(content);
  const referencedTodoIds = collectReferencedTodoIds(parsed.proposal);
  const validTodoMap = await resolveCoachTaskMap({
    userId: options?.userId,
    todos: request.todos,
    ids: referencedTodoIds,
  });
  const normalizedProposal = normalizeProposal(parsed.proposal, {
    validGoalIds: new Set((request.goals ?? []).map((goal) => goal.id)),
    validHabitIds: new Set(request.habits.map((habit) => habit.id)),
    validTodoIds: new Set(validTodoMap.keys()),
  });

  // Validate the response structure
  if (typeof parsed.message !== 'string') {
    throw new Error('Invalid response format: missing message');
  }

  const normalizedResponse: ChatResponse = {
    ...parsed,
    proposal: normalizedProposal,
    leadSkillId: runtimeContext.leadSkillId,
    activeSkillIds:
      runtimeContext.activeSkills.length > 0
        ? runtimeContext.activeSkills.map((skill) => skill.skillId)
        : runtimeContext.leadSkillId === 'general-coach'
          ? []
          : [runtimeContext.leadSkillId],
    skillPhase: runtimeContext.leadSkill?.phase ?? null,
  };

  try {
    await syncCoachRuntimeAfterResponse({
      userId: options?.userId,
      request,
      response: normalizedResponse,
      runtimeContext,
    });
  } catch (error) {
    console.error('Failed to sync coach runtime after response:', error);
  }

  return normalizedResponse;
}

function normalizeProposal(
  proposal: ChatResponse['proposal'],
  grounding: ProposalGroundingContext
): ChatResponse['proposal'] {
  if (proposal === undefined || proposal === null) {
    return proposal;
  }

  if (typeof proposal !== 'object') {
    throw new Error('Invalid response format: proposal must be an object');
  }

  const rawProposal = proposal as unknown as Record<string, unknown>;
  const rawActions = rawProposal.actions;
  const actionList = Array.isArray(rawActions) ? rawActions : [rawActions];
  const normalizedActions = actionList
    .map((action) => normalizeProposalAction(action, grounding))
    .filter((action): action is CoachAction => action !== null);
  const validActionClientKeys = new Set(
    normalizedActions.flatMap((action) =>
      'clientKey' in action && typeof action.clientKey === 'string'
        ? [action.clientKey]
        : []
    )
  );
  const normalizedDailyPlanDraft = normalizeDailyPlanDraft(
    rawProposal.dailyPlanDraft,
    grounding,
    validActionClientKeys
  );

  if (normalizedActions.length === 0 && !normalizedDailyPlanDraft) {
    return null;
  }

  return {
    ...rawProposal,
    actions: normalizedActions,
    dailyPlanDraft: normalizedDailyPlanDraft,
  } as NonNullable<ChatResponse['proposal']>;
}

function normalizeProposalAction(
  action: unknown,
  grounding: ProposalGroundingContext
): CoachAction | null {
  if (!isRecord(action)) {
    return null;
  }

  if (action.entity === 'goal') {
    if (action.operation === 'add' && isRecord(action.goal) && typeof action.goal.title === 'string') {
      return action as CoachAction;
    }

    if (
      action.operation === 'edit' &&
      typeof action.goalId === 'string' &&
      grounding.validGoalIds.has(action.goalId) &&
      isRecord(action.changes)
    ) {
      return action as CoachAction;
    }

    if (
      action.operation === 'archive' &&
      typeof action.goalId === 'string' &&
      grounding.validGoalIds.has(action.goalId)
    ) {
      return action as CoachAction;
    }

    return null;
  }

  if (action.entity === 'habit') {
    if (
      action.operation === 'add' &&
      isRecord(action.habit) &&
      typeof action.habit.name === 'string'
    ) {
      return action as CoachAction;
    }

    if (
      action.operation === 'edit' &&
      typeof action.habitId === 'string' &&
      grounding.validHabitIds.has(action.habitId) &&
      isRecord(action.changes)
    ) {
      return action as CoachAction;
    }

    if (
      (action.operation === 'archive' || action.operation === 'remove') &&
      typeof action.habitId === 'string' &&
      grounding.validHabitIds.has(action.habitId)
    ) {
      return action as CoachAction;
    }

    return null;
  }

  if (action.entity === 'journal' || action.entity === 'diary') {
    return action.operation === 'create' && isRecord(action.entry)
      ? (action as CoachAction)
      : null;
  }

  if (action.operation === 'add' && isRecord(action.todo)) {
    if (typeof action.todo.title !== 'string') {
      return null;
    }

    return {
      ...action,
      todo: normalizeTodoMutation(action.todo),
    } as unknown as CoachAction;
  }

  if (
    action.operation === 'edit' &&
    typeof action.todoId === 'string' &&
    grounding.validTodoIds.has(action.todoId) &&
    isRecord(action.changes)
  ) {
    return {
      ...action,
      changes: normalizeTodoMutation(action.changes),
    } as unknown as CoachAction;
  }

  if (
    action.operation === 'schedule' &&
    typeof action.todoId === 'string' &&
    grounding.validTodoIds.has(action.todoId) &&
    typeof action.scheduledDate === 'string'
  ) {
    const { scheduledBlock, ...rest } = action;
    const normalizedScheduledTime = normalizeScheduledTimeMutation(action);

    return {
      ...rest,
      scheduledTime: normalizedScheduledTime,
    } as unknown as CoachAction;
  }

  if (
    action.operation === 'unschedule' &&
    typeof action.todoId === 'string' &&
    grounding.validTodoIds.has(action.todoId)
  ) {
    return action as CoachAction;
  }

  if (
    (action.operation === 'complete' ||
      action.operation === 'cancel' ||
      action.operation === 'reopen' ||
      action.operation === 'remove') &&
    typeof action.todoId === 'string' &&
    grounding.validTodoIds.has(action.todoId)
  ) {
    return action as CoachAction;
  }

  return null;
}

function normalizeTodoMutation(
  mutation: Record<string, unknown>
): Record<string, unknown> {
  const { scheduledBlock, ...rest } = mutation;
  const scheduledTime = normalizeScheduledTimeMutation(mutation);

  return scheduledTime !== undefined
    ? {
        ...rest,
        scheduledTime,
      }
    : rest;
}

function normalizeDailyPlanDraft(
  draft: unknown,
  grounding: ProposalGroundingContext,
  validActionClientKeys: Set<string>
): DailyPlanDraft | null | undefined {
  if (draft === undefined || draft === null) {
    return draft;
  }

  if (!isRecord(draft) || typeof draft.date !== 'string') {
    return null;
  }

  const items = Array.isArray(draft.items)
    ? draft.items
        .map((item) => normalizeDailyPlanDraftItem(item, grounding, validActionClientKeys))
        .filter((item): item is DailyPlanDraftItem => item !== null)
    : [];

  if (items.length === 0) {
    return null;
  }

  return {
    date: draft.date,
    rationale: typeof draft.rationale === 'string' ? draft.rationale : undefined,
    items,
  };
}

function normalizeDailyPlanDraftItem(
  item: unknown,
  grounding: ProposalGroundingContext,
  validActionClientKeys: Set<string>
): DailyPlanDraftItem | null {
  if (!isRecord(item) || typeof item.title !== 'string') {
    return null;
  }

  const scheduledTime = normalizeScheduledTimeMutation(item);
  if (!scheduledTime) {
    return null;
  }

  const itemType = normalizeDailyPlanItemType(item.itemType);
  const rawRef = isRecord(item.ref) ? item.ref : undefined;
  const ref = normalizeDailyPlanDraftItemRef(rawRef, grounding, validActionClientKeys);

  const normalized: DailyPlanDraftItem = {
    itemType,
    title: item.title,
    scheduledTime,
  };

  if (ref) {
    normalized.ref = ref;
  } else if (itemType === 'habit' || (itemType === 'todo' && rawRef)) {
    normalized.itemType = 'note';
  }

  if (typeof item.notes === 'string') {
    normalized.notes = item.notes;
  }

  if (typeof item.estimateMinutes === 'number' && Number.isFinite(item.estimateMinutes)) {
    normalized.estimateMinutes = item.estimateMinutes;
  }

  if (typeof item.isOptional === 'boolean') {
    normalized.isOptional = item.isOptional;
  }

  return normalized;
}

function normalizeDailyPlanItemType(value: unknown): DailyPlanDraftItem['itemType'] {
  if (value === 'habit' || value === 'todo' || value === 'note') {
    return value;
  }

  return 'note';
}

function normalizeDailyPlanDraftItemRef(
  ref: unknown,
  grounding: ProposalGroundingContext,
  validActionClientKeys: Set<string>
): DailyPlanDraftItemRef | undefined {
  if (!isRecord(ref) || typeof ref.kind !== 'string') {
    return undefined;
  }

  if (
    ref.kind === 'habit' &&
    typeof ref.id === 'string' &&
    grounding.validHabitIds.has(ref.id)
  ) {
    return { kind: ref.kind, id: ref.id };
  }

  if (
    ref.kind === 'todo' &&
    typeof ref.id === 'string' &&
    grounding.validTodoIds.has(ref.id)
  ) {
    return { kind: ref.kind, id: ref.id };
  }

  if (
    ref.kind === 'action' &&
    typeof ref.clientKey === 'string' &&
    validActionClientKeys.has(ref.clientKey)
  ) {
    return { kind: 'action', clientKey: ref.clientKey };
  }

  return undefined;
}

function normalizeScheduledTimeValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const alias = normalizeScheduledTimeAlias(trimmed);
  if (alias) {
    return alias;
  }

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hour = Number.parseInt(colonMatch[1], 10);
    const minute = Number.parseInt(colonMatch[2], 10);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return undefined;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  if (!/^\d{1,4}$/.test(trimmed)) {
    return undefined;
  }

  const digits = trimmed.padStart(trimmed.length <= 2 ? 2 : 4, '0');
  const hour = trimmed.length <= 2
    ? Number.parseInt(digits, 10)
    : Number.parseInt(digits.slice(0, digits.length - 2), 10);
  const minute = trimmed.length <= 2
    ? 0
    : Number.parseInt(digits.slice(-2), 10);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeScheduledTimeMutation(
  mutation: Record<string, unknown>
): string | undefined {
  return normalizeScheduledTimeValue(mutation.scheduledTime)
    ?? normalizeScheduledTimeValue(mutation.scheduledBlock);
}

function normalizeScheduledTimeAlias(value: string): string | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases: Record<string, string> = {
    morning: '09:00',
    afternoon: '13:00',
    'late afternoon': '13:00',
    evening: '18:00',
    tonight: '18:00',
  };

  return aliases[normalized];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
