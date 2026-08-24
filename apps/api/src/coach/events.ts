import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { CoachStreamEvent } from '@habits-coach/shared';

export const HABITRON_TOOL_PREFIX = 'mcp__habitron__';

/** `mcp__habitron__get_day_context` → `get_day_context`; other tools keep their name. */
export function toolDisplayName(name: string): string {
  return name.startsWith(HABITRON_TOOL_PREFIX) ? name.slice(HABITRON_TOOL_PREFIX.length) : name;
}

/**
 * Turns the Agent SDK message stream of one coaching turn into the events the
 * app renders, and collects the coach's reply. The reply is every text block
 * the model produced during the turn (including remarks between tool calls),
 * joined by blank lines — the `done` event carries the canonical text so the
 * client can replace what it streamed.
 */
export class TurnCollector {
  private readonly segments: string[] = [];
  private streamedText = false;
  private finished = false;
  claudeSessionId: string | null = null;

  get text(): string {
    return this.segments.join('\n\n').trim();
  }

  get isFinished(): boolean {
    return this.finished;
  }

  handle(message: SDKMessage): CoachStreamEvent[] {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          this.claudeSessionId = message.session_id;
          return [{ type: 'session', claudeSessionId: message.session_id }];
        }
        return [];

      case 'stream_event': {
        if (message.parent_tool_use_id !== null) return [];
        const { event } = message;
        if (event.type === 'content_block_start' && event.content_block.type === 'text') {
          return this.streamedText ? [{ type: 'text', delta: '\n\n' }] : [];
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text) {
          this.streamedText = true;
          return [{ type: 'text', delta: event.delta.text }];
        }
        return [];
      }

      case 'assistant': {
        if (message.parent_tool_use_id !== null) return [];
        if (message.error) {
          return [{ type: 'error', message: describeAssistantError(message.error) }];
        }
        const events: CoachStreamEvent[] = [];
        for (const block of message.message.content) {
          if (block.type === 'text') {
            if (block.text.trim()) this.segments.push(block.text.trim());
          } else if (block.type === 'tool_use') {
            events.push({ type: 'tool', name: toolDisplayName(block.name) });
          }
        }
        return events;
      }

      case 'result': {
        this.finished = true;
        this.claudeSessionId = message.session_id;
        if (message.subtype !== 'success') {
          return [{ type: 'error', message: describeResultError(message.subtype, message.errors) }];
        }
        const text = this.text || message.result.trim();
        return [{ type: 'done', message: text }];
      }

      default:
        return [];
    }
  }
}

function describeAssistantError(error: string): string {
  switch (error) {
    case 'authentication_failed':
    case 'oauth_org_not_allowed':
      return 'The coach could not sign in to Claude. Check CLAUDE_CODE_OAUTH_TOKEN on the server.';
    case 'rate_limit':
      return 'Claude is rate-limited right now. Give it a minute and try again.';
    case 'overloaded':
    case 'server_error':
      return 'Claude is having trouble right now. Please try again.';
    default:
      return `The coach hit an error (${error}). Please try again.`;
  }
}

function describeResultError(subtype: string, errors: string[]): string {
  if (subtype === 'error_max_turns') {
    return 'That took more steps than one turn allows. Ask again and I will pick up from here.';
  }
  const detail = errors.filter(Boolean).join('; ');
  return detail ? `The coach ran into a problem: ${detail}` : 'The coach ran into a problem. Please try again.';
}
