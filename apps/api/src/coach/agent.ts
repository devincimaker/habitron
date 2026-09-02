import { createSdkMcpServer, query, tool, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createHabitron, localNow, type AnyHabitronTool } from '@habits-coach/habitron';
import type { CoachStreamEvent } from '@habits-coach/shared';
import { config } from '../config.js';
import { HABITRON_TOOL_PREFIX, TurnCollector, type CoachTurnOutcome, type RecordedToolCall } from './events.js';
import { buildSystemPrompt } from './prompt.js';

/** The skills a coaching session may invoke (folders in packages/coach-skills/.claude/skills). */
const COACH_SKILLS = ['coach', 'first-session', 'plan-day', 'review-day', 'review-habits'];
/** The one skill a hold-to-instruct turn runs. */
export const INSTRUCT_SKILLS = ['instruct'];

export interface CoachTurnInput {
  userId: string;
  /** The user's message, or a skill command such as `/coach`. */
  prompt: string;
  timezone: string;
  userName?: string;
  /** The reply is spoken aloud, so the persona switches to its spoken register. */
  voice?: boolean;
  /** Agent SDK session to resume; null on the first turn of a coaching session. */
  claudeSessionId: string | null;
  /** Skills this turn may invoke; defaults to the coaching set. */
  skills?: string[];
  /** Expose only the read-only Habitron tools: a proposal turn that must not change anything. */
  readOnly?: boolean;
  signal?: AbortSignal;
}

export interface CoachTurnResult {
  /** The terminal event the stream carried, so a record of the turn says what the client saw. */
  outcome: CoachTurnOutcome;
  claudeSessionId: string | null;
  /** The write-tool calls the turn made, with arguments — an instruct turn's undo source. */
  writeToolCalls: RecordedToolCall[];
}

function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toolFailure(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Registers the shared Habitron tool list on the SDK's in-process MCP server. */
function createHabitronMcpServer(tools: AnyHabitronTool[]) {
  return createSdkMcpServer({
    name: 'habitron',
    version: '1.0.0',
    tools: tools.map((t) =>
      tool(
        t.name,
        t.description,
        t.inputSchema,
        async (args) => {
          try {
            return toolResult(await t.handler(args));
          } catch (error) {
            return toolFailure(error);
          }
        },
        { annotations: t.annotations }
      )
    ),
  });
}

/**
 * Runs one coaching turn: the Agent SDK loop over the shared skills and the
 * Habitron tools, streaming app-facing events as it goes.
 */
export async function runCoachTurn(
  input: CoachTurnInput,
  onEvent: (event: CoachStreamEvent) => void
): Promise<CoachTurnResult> {
  const habitron = createHabitron({
    supabaseUrl: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
    userId: input.userId,
    timezone: input.timezone,
  });

  const tools = input.readOnly
    ? habitron.tools.filter((t) => t.annotations?.readOnlyHint)
    : habitron.tools;

  const abortController = new AbortController();
  input.signal?.addEventListener('abort', () => abortController.abort(), { once: true });
  const cap = setTimeout(() => abortController.abort(), config.coach.turnCapMs);

  const options: Options = {
    cwd: config.coach.skillsDir,
    systemPrompt: await buildSystemPrompt({
      skillsDir: config.coach.skillsDir,
      userName: input.userName,
      now: localNow(input.timezone),
      timezone: input.timezone,
      voice: input.voice,
    }),
    model: config.coach.model,
    effort: config.coach.effort,
    settingSources: ['project'],
    skills: input.skills ?? COACH_SKILLS,
    tools: ['Skill'],
    allowedTools: ['Skill', ...tools.map((t) => `${HABITRON_TOOL_PREFIX}${t.name}`)],
    permissionMode: 'dontAsk',
    mcpServers: { habitron: createHabitronMcpServer(tools) },
    includePartialMessages: true,
    maxTurns: config.coach.maxTurns,
    resume: input.claudeSessionId ?? undefined,
    abortController,
    stderr: (data) => {
      const line = data.trimEnd();
      if (line) console.error(`[coach] ${line}`);
    },
  };

  const collector = new TurnCollector();
  try {
    for await (const message of query({ prompt: input.prompt, options })) {
      for (const event of collector.handle(message)) onEvent(event);
    }
  } catch (error) {
    // A single-shot query() throws after yielding an error result; that result
    // already produced an `error` event. Anything else is a real failure.
    if (!collector.outcome) throw error;
  } finally {
    clearTimeout(cap);
  }
  if (!collector.outcome) throw new Error('The coach turn ended without a result.');

  const writable = new Set(
    habitron.tools.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name)
  );
  return {
    outcome: collector.outcome,
    claudeSessionId: collector.claudeSessionId,
    writeToolCalls: collector.toolCalls.filter((call) => writable.has(call.name)),
  };
}
