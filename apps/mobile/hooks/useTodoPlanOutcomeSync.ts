import { useCallback } from 'react';
import type { DailyPlanItemOutcome } from '@habits-coach/shared';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';

export function useTodoPlanOutcomeSync() {
  const plansByDate = useDailyPlansStore((state) => state.plansByDate);
  const loadPlan = useDailyPlansStore((state) => state.loadPlan);
  const updateOutcomeForTodo = useDailyPlansStore((state) => state.updateOutcomeForTodo);

  return useCallback(
    async (date: string | undefined, todoId: string, outcome: DailyPlanItemOutcome) => {
      if (!date) return;

      if (!(date in plansByDate)) {
        await loadPlan(date);
      }

      await updateOutcomeForTodo(date, todoId, outcome);
    },
    [loadPlan, plansByDate, updateOutcomeForTodo]
  );
}
