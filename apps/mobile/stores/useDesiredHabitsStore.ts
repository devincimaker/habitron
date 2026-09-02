import { create } from 'zustand';
import type { DesiredHabit, DesiredHabitDraft } from '@habits-coach/shared';
import * as desiredHabitsService from '../services/desiredHabits';

type DesiredHabitChanges = { title?: string; note?: string; habitId?: string | null };

interface DesiredHabitsState {
  desiredHabits: DesiredHabit[];
  isLoading: boolean;

  loadDesiredHabits: () => Promise<void>;
  /** Optimistic: the row shows at once; the promise resolves with the server row. */
  addDesiredHabit: (draft: DesiredHabitDraft) => Promise<DesiredHabit>;
  updateDesiredHabit: (id: string, updates: DesiredHabitChanges) => Promise<void>;
  removeDesiredHabit: (id: string) => Promise<void>;
  clearDesiredHabits: () => void;
}

/** Mirrors the service: an empty note clears, `null` unlinks the habit. */
function applyChanges(desired: DesiredHabit, updates: DesiredHabitChanges): DesiredHabit {
  return {
    ...desired,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.note !== undefined ? { note: updates.note || undefined } : {}),
    ...(updates.habitId !== undefined ? { habitId: updates.habitId ?? undefined } : {}),
    updatedAt: Date.now(),
  };
}

function replaceDesired(list: DesiredHabit[], id: string, next: DesiredHabit): DesiredHabit[] {
  return list.map((desired) => (desired.id === id ? next : desired));
}

export const useDesiredHabitsStore = create<DesiredHabitsState>((set, get) => ({
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
    const now = Date.now();
    const optimistic: DesiredHabit = {
      id: `optimistic-desired-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title,
      note: draft.note,
      createdAt: now,
    };
    set((state) => ({ desiredHabits: [...state.desiredHabits, optimistic] }));

    try {
      const created = await desiredHabitsService.addDesiredHabit(draft);
      set((state) => ({ desiredHabits: replaceDesired(state.desiredHabits, optimistic.id, created) }));
      return created;
    } catch (error) {
      set((state) => ({
        desiredHabits: state.desiredHabits.filter((desired) => desired.id !== optimistic.id),
      }));
      throw error;
    }
  },

  updateDesiredHabit: async (id, updates) => {
    const current = get().desiredHabits.find((desired) => desired.id === id);
    if (current) {
      set((state) => ({
        desiredHabits: replaceDesired(state.desiredHabits, id, applyChanges(current, updates)),
      }));
    }

    try {
      await desiredHabitsService.updateDesiredHabit(id, updates);
    } catch (error) {
      if (current) {
        set((state) => ({ desiredHabits: replaceDesired(state.desiredHabits, id, current) }));
      }
      throw error;
    }
  },

  removeDesiredHabit: async (id) => {
    const { desiredHabits } = get();
    set({ desiredHabits: desiredHabits.filter((desired) => desired.id !== id) });

    try {
      await desiredHabitsService.removeDesiredHabit(id);
    } catch (error) {
      set({ desiredHabits });
      throw error;
    }
  },

  clearDesiredHabits: () => {
    set({ desiredHabits: [] });
  },
}));
