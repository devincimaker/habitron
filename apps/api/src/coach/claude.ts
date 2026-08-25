import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config.js';

/**
 * One tool-less Claude call through the Agent SDK (so it rides the same
 * subscription auth as the coach). Used for session names and memory
 * extraction; the conversation is not persisted.
 */
export async function runClaudeText(args: { system: string; prompt: string }): Promise<string> {
  const options: Options = {
    systemPrompt: args.system,
    model: config.coach.model,
    effort: 'low',
    settingSources: [],
    tools: [],
    allowedTools: [],
    permissionMode: 'dontAsk',
    maxTurns: 1,
    persistSession: false,
  };

  for await (const message of query({ prompt: args.prompt, options })) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        return message.result.trim();
      }
      throw new Error(`Claude call failed (${message.subtype}): ${message.errors.join('; ')}`);
    }
  }

  throw new Error('Claude call ended without a result');
}

/** Parses a JSON object out of a model reply, tolerating a ```json fence around it. */
export function parseJsonReply<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate) as T;
}
