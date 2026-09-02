import { create } from 'zustand';
import type {
  DailyPlan,
  DailyPlanItem,
  DailyPlanItemOutcome,
} from '@habits-coach/shared';
import * as dailyPlansService from '../services/dailyPlans';

interface DailyPlansState {
  plansByDate: Record<string, DailyPlan | null>;
  isLoading: boolean;
  loadPlan: (date: string) => Promise<DailyPlan | null>;
  updateOutcomeForTodo: (
    date: string,
    todoId: string,
    outcome: DailyPlanItemOutcome
  ) => Promise<void>;
  updateOutcomeForHabit: (
    date: string,
    habitId: string,
    outcome: DailyPlanItemOutcome
  ) => Promise<void>;
  clearPlans: () => void;
}

function withItemOutcome(
  plan: DailyPlan,
  itemId: string,
  outcome: DailyPlanItemOutcome
): DailyPlan {
  return {
    ...plan,
    items: plan.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            outcome,
            resolvedAt: outcome === 'planned' ? undefined : Date.now(),
          }
        : item
    ),
  };
}

export const useDailyPlansStore = create<DailyPlansState>((set, get) => {
  /** Optimistic: the outcome shows before the write, and the old plan comes back if it fails. */
  async function resolveItem(
    date: string,
    matcher: (item: DailyPlanItem) => boolean,
    outcome: DailyPlanItemOutcome
  ): Promise<void> {
    const plan = get().plansByDate[date];
    const item = plan?.items.find(matcher);
    if (!plan || !item) return;

    set((state) => ({
      plansByDate: { ...state.plansByDate, [date]: withItemOutcome(plan, item.id, outcome) },
    }));

    try {
      await dailyPlansService.updateDailyPlanItemOutcome(item.id, outcome);
    } catch (error) {
      set((state) => ({ plansByDate: { ...state.plansByDate, [date]: plan } }));
      throw error;
    }
  }

  return {
    plansByDate: {},
    isLoading: false,

    loadPlan: async (date) => {
      set({ isLoading: true });
      try {
        const plan = await dailyPlansService.getDailyPlan(date);
        set((state) => ({
          plansByDate: { ...state.plansByDate, [date]: plan },
          isLoading: false,
        }));
        return plan;
      } catch (error) {
        console.error('Failed to load daily plan:', error);
        set({ isLoading: false });
        return null;
      }
    },

    updateOutcomeForTodo: (date, todoId, outcome) =>
      resolveItem(date, (item) => item.todoId === todoId, outcome),

    updateOutcomeForHabit: (date, habitId, outcome) =>
      resolveItem(date, (item) => item.habitId === habitId, outcome),

    clearPlans: () => {
      set({ plansByDate: {}, isLoading: false });
    },
  };
});
