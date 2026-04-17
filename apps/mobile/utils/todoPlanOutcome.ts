import type { DailyPlanItemOutcome, TodoStatus } from '@habits-coach/shared';

export function getTodoPlanOutcomeForStatus(status: TodoStatus): DailyPlanItemOutcome {
  if (status === 'completed') return 'completed_as_planned';
  if (status === 'canceled') return 'canceled';
  return 'planned';
}
