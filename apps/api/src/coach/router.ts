import type { ChatRequest, CoachSkillId } from '@habits-coach/shared';

const DAY_PLANNING_PATTERNS = [
  /\bplan my day\b/i,
  /\breplan\b/i,
  /\bhelp me plan\b/i,
  /\bprioriti(?:s|z)e (?:my )?(?:day|today)\b/i,
  /\bwhat should i do today\b/i,
  /\borgani[sz]e (?:my )?(?:day|today)\b/i,
  /\bschedule (?:my )?(?:day|today)\b/i,
  /\bmy day changed\b/i,
  /\bfigure out today\b/i,
];

const TASK_MANAGEMENT_PATTERNS = [
  /\b(add|create|capture)\b.*\b(task|tasks|todo|todos)\b/i,
  /\b(task|tasks|todo|todos)\b.*\b(add|create|capture)\b/i,
  /\b(edit|update|rename|reschedule|schedule|unschedule|complete|cancel|reopen|delete|remove|prune|dedup|cleanup|clean up|triage)\b.*\b(task|tasks|todo|todos|duplicate|duplicates)\b/i,
  /\b(task|tasks|todo|todos|duplicate|duplicates)\b.*\b(edit|update|rename|reschedule|schedule|unschedule|complete|cancel|reopen|delete|remove|prune|dedup|cleanup|clean up|triage)\b/i,
  /\bhow many open tasks\b/i,
  /\bwhat tasks do i have\b/i,
  /\btoo many tasks\b/i,
  /\bduplicate tasks?\b/i,
];

const HABIT_DESIGN_PATTERNS = [
  /\b(start|build|create|design|make)\b.*\b(habit|habits|routine|routines)\b/i,
  /\b(habit|habits|routine|routines)\b.*\b(start|build|create|design|make)\b/i,
  /\b(keep missing|keep skipping|keep failing|can'?t stick to|not sticking to)\b.*\b(habit|habits|routine|routines)\b/i,
  /\b(habit|habits|routine|routines)\b.*\b(not working|too hard|too big|isn't working|aren't working|doesn't fit|don't fit)\b/i,
  /\b(expand|grow|scale up|increase|stretch)\b.*\b(habit|habits|routine|routines)\b/i,
  /\b(shrink|reduce|simplify|contract)\b.*\b(habit|habits|routine|routines)\b/i,
  /\b(archive|pause|retire)\b.*\b(habit|habits|routine|routines)\b/i,
  /\b(habit|habits|routine|routines)\b.*\b(archive|pause|retire)\b/i,
  /\b(?:make|turn)\b.*\b(?:a |an )?(?:daily|weekly)\s+(habit|routine)\b/i,
];

function getRecentUserMessages(request: ChatRequest, limit = 3): string[] {
  return request.messages
    .filter((message) => message.role === 'user')
    .slice(-limit)
    .map((message) => message.content);
}

function matchesDayPlanningIntent(text: string): boolean {
  return DAY_PLANNING_PATTERNS.some((pattern) => pattern.test(text));
}

function matchesTaskManagementIntent(text: string): boolean {
  return TASK_MANAGEMENT_PATTERNS.some((pattern) => pattern.test(text));
}

function matchesHabitDesignIntent(text: string): boolean {
  return HABIT_DESIGN_PATTERNS.some((pattern) => pattern.test(text));
}

export function inferCoachSkillId(request: ChatRequest): CoachSkillId {
  const recentUserMessages = getRecentUserMessages(request);

  if (recentUserMessages.some(matchesDayPlanningIntent)) {
    return 'day-planning';
  }

  if (recentUserMessages.some(matchesHabitDesignIntent)) {
    return 'habit-design';
  }

  if (recentUserMessages.some(matchesTaskManagementIntent)) {
    return 'task-management';
  }

  return 'general-coach';
}

export const selectCoachSkillId = inferCoachSkillId;
