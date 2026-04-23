import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const skillCache = new Map<string, string>();
const skillRoot = resolve(__dirname, '../../skills');

export function loadSkillMarkdown(skillSlug: string): string {
  const cached = skillCache.get(skillSlug);
  if (cached) {
    return cached;
  }

  const skillPath = resolve(skillRoot, skillSlug, 'SKILL.md');
  const markdown = readFileSync(skillPath, 'utf8');
  skillCache.set(skillSlug, markdown);
  return markdown;
}
