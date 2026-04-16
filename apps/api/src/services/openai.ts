import OpenAI from 'openai';
import { config } from '../config.js';
import type { ChatRequest, ChatResponse } from '@habits-coach/shared';

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
- When the user explicitly asks for planning, you may propose concrete actions and a daily plan.
- Keep plans realistic. Prefer a focused day over an overloaded one.
- Use journal context, recent commitments, and current workload to infer capacity.

## What You Can Propose
- Goal changes: add, edit, archive
- Habit changes: add, edit, remove
- Task changes: add, edit, schedule, unschedule, complete, cancel, reopen, remove
- Journal capture: create
- Daily plan draft with morning / afternoon / evening blocks

## Proposal Rules
- Only include a proposal when you have enough context to justify it.
- Batch related changes inside a single proposal.
- If a daily plan draft includes a brand-new task or habit created in the same proposal, give the create action a unique \`clientKey\` and reference it from the plan item using \`{ "kind": "action", "clientKey": "..." }\`.
- Use existing entity IDs whenever you are editing or removing something that already exists.
- Do not fabricate IDs.
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
          "scheduledBlock": "morning",
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
    const details = [item.scheduledBlock, item.outcome]
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

export async function sendMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const messages = buildMessages(request);

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    ...getTokenLimitParam(500),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const parsed = JSON.parse(content) as ChatResponse;
  const normalizedProposal = normalizeProposal(parsed.proposal);

  // Validate the response structure
  if (typeof parsed.message !== 'string') {
    throw new Error('Invalid response format: missing message');
  }

  return {
    ...parsed,
    proposal: normalizedProposal,
  };
}

function normalizeProposal(
  proposal: ChatResponse['proposal']
): ChatResponse['proposal'] {
  if (proposal === undefined || proposal === null) {
    return proposal;
  }

  if (typeof proposal !== 'object') {
    throw new Error('Invalid response format: proposal must be an object');
  }

  const rawProposal = proposal as unknown as Record<string, unknown>;
  const rawActions = rawProposal.actions;

  if (rawActions === undefined || rawActions === null) {
    return {
      ...rawProposal,
      actions: [],
    } as NonNullable<ChatResponse['proposal']>;
  }

  if (Array.isArray(rawActions)) {
    return proposal;
  }

  return {
    ...rawProposal,
    actions: [rawActions],
  } as NonNullable<ChatResponse['proposal']>;
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
