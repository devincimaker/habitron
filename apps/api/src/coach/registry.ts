import type { CoachSkillId } from '@habits-coach/shared';
import { loadSkillMarkdown } from './skillLoader.js';

export interface CoachSkillDefinition {
  id: CoachSkillId;
  label: string;
  description: string;
  instructions: string;
}

const GENERAL_COACH_INSTRUCTIONS = `# General Coach Skill

## Purpose

Handle broad coaching conversation when no specialized skill is a better fit.

## Behavior

- be warm, specific, and honest
- ask clarifying questions when context is thin
- help the user think clearly before pushing changes
- only include structured proposals when they are well justified

## Scope

You may discuss goals, habits, tasks, journal context, and daily plans, but you are not required to force the conversation into planning unless the user is actually asking for planning help.`;

export const COACH_SKILL_IDS: CoachSkillId[] = [
  'general-coach',
  'day-planning',
  'task-management',
  'habit-design',
];

export function isCoachSkillId(value: string): value is CoachSkillId {
  return COACH_SKILL_IDS.includes(value as CoachSkillId);
}

export function getCoachSkillDefinition(skillId: CoachSkillId): CoachSkillDefinition {
  if (skillId === 'day-planning') {
    return {
      id: 'day-planning',
      label: 'Day Planning',
      description: 'Interactive daily planning and replanning.',
      instructions: loadSkillMarkdown('day-planning'),
    };
  }

  if (skillId === 'task-management') {
    return {
      id: 'task-management',
      label: 'Task Management',
      description: 'Task capture, cleanup, prioritization, and restructuring.',
      instructions: loadSkillMarkdown('task-management'),
    };
  }

  if (skillId === 'habit-design') {
    return {
      id: 'habit-design',
      label: 'Habit Design',
      description: 'Create, expand, contract, and archive habits to fit real life.',
      instructions: loadSkillMarkdown('habit-design'),
    };
  }

  return {
    id: 'general-coach',
    label: 'General Coach',
    description: 'General coaching conversation and non-specialized guidance.',
    instructions: GENERAL_COACH_INSTRUCTIONS,
  };
}
