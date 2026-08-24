import { createSdkMcpServer, query, tool, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createHabitron, localNow, type AnyHabitronTool } from '@habits-coach/habitron';
import type { CoachStreamEvent } from '@habits-coach/shared';
import { config } from '../config.js';
import { TurnCollector } from './events.js';
import { buildSystemPrompt } from './prompt.js';

/** The skills the in-app coach may invoke (the folders in packages/coach-skills/.claude/skills). */
export const COACH_SKILLS = ['coach', 'first-session', 'plan-day', 'review-day', 'review-habits'];

export interface CoachTurnInput {
  userId: string;
  /** The user's message, or a skill command such as `/coach`. */
  prompt: string;
  timezone: string;
  userName?: string;
  /** Agent SDK session to resume; null on the first turn of a coaching session. */
  claudeSessionId: string | null;
  signal?: AbortSignal;
}

export interface CoachTurnResult {
  text: string;
  claudeSessionId: string | null;
}

function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toolFailure(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Registers the shared Habitron tool list on the SDK's in-process MCP server. */
export function createHabitronMcpServer(tools: AnyHabitronTool[]) {
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

  const abortController = new AbortController();
  input.signal?.addEventListener('abort', () => abortController.abort(), { once: true });

  const options: Options = {
    cwd: config.coach.skillsDir,
    systemPrompt: await buildSystemPrompt({
      skillsDir: config.coach.skillsDir,
      userName: input.userName,
      now: localNow(input.timezone),
      timezone: input.timezone,
    }),
    model: config.coach.model,
    effort: config.coach.effort,
    settingSources: ['project'],
    skills: COACH_SKILLS,
    tools: ['Skill'],
    allowedTools: ['Skill', 'mcp__habitron__*'],
    permissionMode: 'dontAsk',
    mcpServers: { habitron: createHabitronMcpServer(habitron.tools) },
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
    if (!collector.isFinished) throw error;
  }

  return { text: collector.text, claudeSessionId: collector.claudeSessionId };
}
