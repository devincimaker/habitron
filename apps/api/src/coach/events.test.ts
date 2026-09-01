import { describe, expect, it } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { TurnCollector, toolDisplayName } from './events.js';

function assistant(content: Array<Record<string, unknown>>): SDKMessage {
  return {
    type: 'assistant',
    message: { content },
    parent_tool_use_id: null,
  } as unknown as SDKMessage;
}

function textDelta(text: string): SDKMessage {
  return {
    type: 'stream_event',
    parent_tool_use_id: null,
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  } as unknown as SDKMessage;
}

function textBlockStart(): SDKMessage {
  return {
    type: 'stream_event',
    parent_tool_use_id: null,
    event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  } as unknown as SDKMessage;
}

function result(overrides: Record<string, unknown>): SDKMessage {
  return { type: 'result', session_id: 'claude-1', ...overrides } as unknown as SDKMessage;
}

describe('toolDisplayName', () => {
  it('strips the habitron MCP prefix', () => {
    expect(toolDisplayName('mcp__habitron__get_day_context')).toBe('get_day_context');
    expect(toolDisplayName('Skill')).toBe('Skill');
  });
});

describe('TurnCollector', () => {
  it('reports the session id from the init message', () => {
    const collector = new TurnCollector();
    const events = collector.handle({ type: 'system', subtype: 'init', session_id: 'claude-1' } as unknown as SDKMessage);

    expect(events).toEqual([{ type: 'session', claudeSessionId: 'claude-1' }]);
    expect(collector.claudeSessionId).toBe('claude-1');
  });

  it('streams text deltas and separates text blocks that follow a tool call', () => {
    const collector = new TurnCollector();

    expect(collector.handle(textBlockStart())).toEqual([]);
    expect(collector.handle(textDelta('Let me look'))).toEqual([{ type: 'text', delta: 'Let me look' }]);
    expect(collector.handle(textBlockStart())).toEqual([{ type: 'text', delta: '\n\n' }]);
    expect(collector.handle(textDelta('You have 3 tasks.'))).toEqual([{ type: 'text', delta: 'You have 3 tasks.' }]);
  });

  it('collects assistant text across tool calls and emits tool events', () => {
    const collector = new TurnCollector();

    expect(
      collector.handle(
        assistant([
          { type: 'text', text: 'Let me look at your day.' },
          { type: 'tool_use', id: 't1', name: 'mcp__habitron__get_day_context', input: {} },
        ])
      )
    ).toEqual([{ type: 'tool', name: 'get_day_context' }]);
    expect(collector.handle(assistant([{ type: 'text', text: 'You have 3 tasks today. Want to plan?' }]))).toEqual([]);

    const done = collector.handle(result({ subtype: 'success', result: 'You have 3 tasks today. Want to plan?' }));

    expect(done).toEqual([{ type: 'done', message: 'Let me look at your day.\n\nYou have 3 tasks today. Want to plan?' }]);
    expect(collector.outcome).toEqual(done[0]);
  });

  it('records habitron tool calls with their arguments, and only those', () => {
    const collector = new TurnCollector();

    collector.handle(
      assistant([
        { type: 'tool_use', id: 't1', name: 'Skill', input: { skill: 'instruct' } },
        { type: 'tool_use', id: 't2', name: 'mcp__habitron__list_tasks', input: { query: 'run' } },
        { type: 'tool_use', id: 't3', name: 'mcp__habitron__update_task', input: { id: 'a', scheduledTime: '18:00' } },
      ])
    );

    expect(collector.toolCalls).toEqual([
      { name: 'list_tasks', input: { query: 'run' } },
      { name: 'update_task', input: { id: 'a', scheduledTime: '18:00' } },
    ]);
  });

  it('ignores messages produced inside subagents', () => {
    const collector = new TurnCollector();
    const nested = { ...assistant([{ type: 'text', text: 'hidden' }]), parent_tool_use_id: 'parent' } as SDKMessage;

    expect(collector.handle(nested)).toEqual([]);
    expect(collector.text).toBe('');
  });

  it('turns an error result into an error event', () => {
    const collector = new TurnCollector();
    const events = collector.handle(result({ subtype: 'error_max_turns', errors: [] }));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    // The record of the turn reads the same event, so a failed turn is never recovered as a reply.
    expect(collector.outcome).toEqual(events[0]);
  });

  it('surfaces assistant-level API errors', () => {
    const collector = new TurnCollector();
    const events = collector.handle({ ...assistant([]), error: 'rate_limit' } as SDKMessage);

    expect(events).toEqual([
      { type: 'error', message: 'Claude is rate-limited right now. Give it a minute and try again.' },
    ]);
  });
});
