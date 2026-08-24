import { describe, expect, it } from 'vitest';
import { parseJsonReply } from './claude.js';

describe('parseJsonReply', () => {
  it('parses a bare JSON object', () => {
    expect(parseJsonReply<{ memories: unknown[] }>('{"memories":[]}')).toEqual({ memories: [] });
  });

  it('parses JSON wrapped in a code fence with prose around it', () => {
    const reply = 'Here you go:\n```json\n{"memories":[{"content":"x","category":"goal"}]}\n```\nDone.';
    expect(parseJsonReply<{ memories: unknown[] }>(reply)).toEqual({
      memories: [{ content: 'x', category: 'goal' }],
    });
  });

  it('parses JSON surrounded by prose without a fence', () => {
    expect(parseJsonReply<{ a: number }>('Sure. {"a": 1} That is all.')).toEqual({ a: 1 });
  });
});
