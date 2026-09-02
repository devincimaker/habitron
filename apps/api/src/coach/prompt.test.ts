import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { buildSystemPrompt } from './prompt.js';

const skillsDir = resolve(import.meta.dirname, '../../../../packages/coach-skills');
const now = { weekday: 'Tuesday', date: '2026-09-01', time: '18:30' } as const;

describe('buildSystemPrompt', () => {
  it('writes for a phone screen by default', async () => {
    const prompt = await buildSystemPrompt({ skillsDir, now, timezone: 'Europe/Madrid' });

    expect(prompt).toContain('Write for a phone screen');
    expect(prompt).not.toContain('## Speaking aloud');
  });

  it('switches to the spoken register when the reply is spoken aloud', async () => {
    const prompt = await buildSystemPrompt({ skillsDir, now, timezone: 'Europe/Madrid', voice: true });

    expect(prompt).toContain('## Speaking aloud');
    expect(prompt).toContain('One question at a time');
    expect(prompt).not.toContain('Write for a phone screen');
  });
});
