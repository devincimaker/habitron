import { describe, expect, it } from 'vitest';
import { decideLeadSkillId } from './runtime.js';

describe('decideLeadSkillId', () => {
  it('promotes an explicitly inferred specialized skill', () => {
    expect(decideLeadSkillId([], 'day-planning')).toBe('day-planning');
    expect(decideLeadSkillId([], 'habit-design')).toBe('habit-design');
  });

  it('keeps a persisted lead specialist sticky when current turn is generic', () => {
    expect(
      decideLeadSkillId(
        [
          {
            skill_id: 'day-planning',
            status: 'active',
            is_lead: true,
          },
        ],
        'general-coach'
      )
    ).toBe('day-planning');
  });

  it('falls back to general coach when there is no active specialist', () => {
    expect(
      decideLeadSkillId(
        [
          {
            skill_id: 'day-planning',
            status: 'completed',
            is_lead: false,
          },
        ],
        'general-coach'
      )
    ).toBe('general-coach');
  });
});
