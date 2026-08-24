import { create } from 'zustand';
import type {
  DailyPlan,
  DailyPlanItemOutcome,
} from '@habits-coach/shared';
import * as dailyPlansService from '../services/dailyPlans';

interface DailyPlansState {
  plansByDate: Record<string, DailyPlan | null>;
  isLoading: boolean;
  loadPlan: (date: string) => Promise<DailyPlan | null>;
  updateItemOutcome: (
    date: string,
    itemId: string,
    outcome: DailyPlanItemOutcome
  ) => Promise<void>;
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

function updatePlanItemOutcomeLocally(
  plan: DailyPlan,
  matcher: (item: DailyPlan['items'][number]) => boolean,
  outcome: DailyPlanItemOutcome
): DailyPlan {
  return {
    ...plan,
    items: plan.items.map((item) =>
      matcher(item)
        ? {
            ...item,
            outcome,
            resolvedAt: outcome === 'planned' ? undefined : Date.now(),
          }
        : item
    ),
  };
}

export const useDailyPlansStore = create<DailyPlansState>((set, get) => ({
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

  updateItemOutcome: async (date, itemId, outcome) => {
    const plan = get().plansByDate[date];
    if (!plan) return;

    await dailyPlansService.updateDailyPlanItemOutcome(itemId, outcome);
    set((state) => ({
      plansByDate: {
        ...state.plansByDate,
        [date]: updatePlanItemOutcomeLocally(
          plan,
          (item) => item.id === itemId,
          outcome
        ),
      },
    }));
  },

  updateOutcomeForTodo: async (date, todoId, outcome) => {
    const plan = get().plansByDate[date];
    if (!plan) return;

    const item = plan.items.find((candidate) => candidate.todoId === todoId);
    if (!item) return;

    await dailyPlansService.updateDailyPlanItemOutcome(item.id, outcome);
    set((state) => ({
      plansByDate: {
        ...state.plansByDate,
        [date]: updatePlanItemOutcomeLocally(
          plan,
          (candidate) => candidate.id === item.id,
          outcome
        ),
      },
    }));
  },

  updateOutcomeForHabit: async (date, habitId, outcome) => {
    const plan = get().plansByDate[date];
    if (!plan) return;

    const item = plan.items.find((candidate) => candidate.habitId === habitId);
    if (!item) return;

    await dailyPlansService.updateDailyPlanItemOutcome(item.id, outcome);
    set((state) => ({
      plansByDate: {
        ...state.plansByDate,
        [date]: updatePlanItemOutcomeLocally(
          plan,
          (candidate) => candidate.id === item.id,
          outcome
        ),
      },
    }));
  },

  clearPlans: () => {
    set({ plansByDate: {}, isLoading: false });
  },
}));
