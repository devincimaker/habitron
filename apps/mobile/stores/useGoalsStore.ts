import { create } from 'zustand';
import type { Goal, GoalDraft } from '@habits-coach/shared';
import * as goalsService from '../services/goals';
import type { GoalChanges } from '../services/goals';

interface GoalsState {
  goals: Goal[];
  isLoading: boolean;
  loadGoals: () => Promise<void>;
  /** Optimistic: the goal shows at once; the promise resolves with the server row. */
  addGoal: (draft: GoalDraft) => Promise<Goal>;
  updateGoal: (goalId: string, changes: GoalChanges) => Promise<void>;
  /** Marks the goal done now, or reopens it. */
  setGoalDone: (goalId: string, done: boolean) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  clearGoals: () => void;
}

/** Mirrors the service: `completedAt: null` reopens the goal. */
function applyChanges(goal: Goal, changes: GoalChanges): Goal {
  const { completedAt, ...fields } = changes;
  return {
    ...goal,
    ...fields,
    ...(completedAt !== undefined ? { completedAt: completedAt ?? undefined } : {}),
    updatedAt: Date.now(),
  };
}

function replaceGoal(list: Goal[], id: string, next: Goal): Goal[] {
  return list.map((goal) => (goal.id === id ? next : goal));
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  isLoading: false,

  loadGoals: async () => {
    set({ isLoading: true });
    try {
      const goals = await goalsService.getGoals();
      set({ goals, isLoading: false });
    } catch (error) {
      console.error('Failed to load goals:', error);
      set({ isLoading: false });
    }
  },

  addGoal: async (draft) => {
    const now = Date.now();
    const optimistic: Goal = {
      id: `optimistic-goal-${now}-${Math.random().toString(36).slice(2, 8)}`,
      ...draft,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ goals: [...state.goals, optimistic] }));

    try {
      const created = await goalsService.addGoal(draft);
      set((state) => ({ goals: replaceGoal(state.goals, optimistic.id, created) }));
      return created;
    } catch (error) {
      set((state) => ({ goals: state.goals.filter((goal) => goal.id !== optimistic.id) }));
      throw error;
    }
  },

  updateGoal: async (goalId, changes) => {
    const current = get().goals.find((goal) => goal.id === goalId);
    if (current) {
      set((state) => ({ goals: replaceGoal(state.goals, goalId, applyChanges(current, changes)) }));
    }

    try {
      await goalsService.updateGoal(goalId, changes);
    } catch (error) {
      if (current) {
        set((state) => ({ goals: replaceGoal(state.goals, goalId, current) }));
      }
      throw error;
    }
  },

  setGoalDone: (goalId, done) =>
    get().updateGoal(goalId, { completedAt: done ? Date.now() : null }),

  deleteGoal: async (goalId) => {
    const { goals } = get();
    set({ goals: goals.filter((goal) => goal.id !== goalId) });

    try {
      await goalsService.deleteGoal(goalId);
    } catch (error) {
      set({ goals });
      throw error;
    }
  },

  clearGoals: () => {
    set({ goals: [], isLoading: false });
  },
}));
