import { create } from 'zustand';
import type { Goal, GoalDraft } from '@habits-coach/shared';
import * as goalsService from '../services/goals';

interface GoalsState {
  goals: Goal[];
  isLoading: boolean;
  loadGoals: () => Promise<void>;
  addGoal: (goal: GoalDraft) => Promise<Goal>;
  updateGoal: (goalId: string, changes: Partial<GoalDraft>) => Promise<Goal>;
  archiveGoal: (goalId: string) => Promise<Goal>;
  clearGoals: () => void;
}

export const useGoalsStore = create<GoalsState>((set) => ({
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

  addGoal: async (goal) => {
    const createdGoal = await goalsService.addGoal(goal);
    set((state) => ({ goals: [...state.goals, createdGoal] }));
    return createdGoal;
  },

  updateGoal: async (goalId, changes) => {
    const updatedGoal = await goalsService.updateGoal(goalId, changes);
    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === goalId ? updatedGoal : goal)),
    }));
    return updatedGoal;
  },

  archiveGoal: async (goalId) => {
    const archivedGoal = await goalsService.archiveGoal(goalId);
    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === goalId ? archivedGoal : goal)),
    }));
    return archivedGoal;
  },

  clearGoals: () => {
    set({ goals: [], isLoading: false });
  },
}));
