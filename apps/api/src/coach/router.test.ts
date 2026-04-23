import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '@habits-coach/shared';
import { selectCoachSkillId } from './router.js';

function makeRequest(messages: ChatRequest['messages']): ChatRequest {
  return {
    messages,
    habits: [],
    goals: [],
    todos: [],
    journalEntries: [],
    dailyPlan: null,
    memories: [],
  };
}

describe('selectCoachSkillId', () => {
  it('selects day-planning for explicit planning requests', () => {
    const skill = selectCoachSkillId(
      makeRequest([{ role: 'user', content: 'Plan my day for me.' }])
    );

    expect(skill).toBe('day-planning');
  });

  it('keeps day-planning active for recent planning follow-up answers', () => {
    const skill = selectCoachSkillId(
      makeRequest([
        { role: 'user', content: 'Plan my day.' },
        { role: 'assistant', content: 'What matters most today and what constraints do you have?' },
        { role: 'user', content: 'I need to ship one thing and I am pretty tired.' },
      ])
    );

    expect(skill).toBe('day-planning');
  });

  it('selects habit-design for habit friction', () => {
    const skill = selectCoachSkillId(
      makeRequest([{ role: 'user', content: 'I keep missing my habit on weekends.' }])
    );

    expect(skill).toBe('habit-design');
  });

  it('keeps habit-design active for recent follow-up answers', () => {
    const skill = selectCoachSkillId(
      makeRequest([
        { role: 'user', content: 'I want to build a reading habit.' },
        { role: 'assistant', content: 'What would make it easy enough to stick this week?' },
        { role: 'user', content: 'Ten minutes in the evening feels realistic.' },
      ])
    );

    expect(skill).toBe('habit-design');
  });

  it('selects task-management for duplicate cleanup requests', () => {
    const skill = selectCoachSkillId(
      makeRequest([{ role: 'user', content: 'Please prune the duplicate tasks.' }])
    );

    expect(skill).toBe('task-management');
  });

  it('selects task-management for task capture requests', () => {
    const skill = selectCoachSkillId(
      makeRequest([{ role: 'user', content: 'Add a task to send the invoice tomorrow.' }])
    );

    expect(skill).toBe('task-management');
  });
});
