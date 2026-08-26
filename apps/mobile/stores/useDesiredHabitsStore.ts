import { create } from 'zustand';
import type { DesiredHabit, DesiredHabitDraft } from '@habits-coach/shared';
import * as desiredHabitsService from '../services/desiredHabits';

interface DesiredHabitsState {
  desiredHabits: DesiredHabit[];
  isLoading: boolean;

  loadDesiredHabits: () => Promise<void>;
  addDesiredHabit: (draft: DesiredHabitDraft) => Promise<DesiredHabit>;
  updateDesiredHabit: (
    id: string,
    updates: { title?: string; note?: string; habitId?: string | null }
  ) => Promise<void>;
  removeDesiredHabit: (id: string) => Promise<void>;
  clearDesiredHabits: () => void;
}

export const useDesiredHabitsStore = create<DesiredHabitsState>((set) => ({
  desiredHabits: [],
  isLoading: false,

  loadDesiredHabits: async () => {
    set({ isLoading: true });
    try {
      const desiredHabits = await desiredHabitsService.getDesiredHabits();
      set({ desiredHabits, isLoading: false });
    } catch (error) {
      console.error('Failed to load desired habits:', error);
      set({ isLoading: false });
    }
  },

  addDesiredHabit: async (draft) => {
    const created = await desiredHabitsService.addDesiredHabit(draft);
    set((state) => ({ desiredHabits: [...state.desiredHabits, created] }));
    return created;
  },

  updateDesiredHabit: async (id, updates) => {
    await desiredHabitsService.updateDesiredHabit(id, updates);
    set((state) => ({
      desiredHabits: state.desiredHabits.map((desired) =>
        desired.id === id
          ? {
              ...desired,
              ...(updates.title !== undefined ? { title: updates.title } : {}),
              ...(updates.note !== undefined ? { note: updates.note || undefined } : {}),
              ...(updates.habitId !== undefined
                ? { habitId: updates.habitId ?? undefined }
                : {}),
              updatedAt: Date.now(),
            }
          : desired
      ),
    }));
  },

  removeDesiredHabit: async (id) => {
    await desiredHabitsService.removeDesiredHabit(id);
    set((state) => ({
      desiredHabits: state.desiredHabits.filter((desired) => desired.id !== id),
    }));
  },

  clearDesiredHabits: () => {
    set({ desiredHabits: [] });
  },
}));
