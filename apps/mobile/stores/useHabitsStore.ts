import { create } from 'zustand';
import { Habit, HabitWithStatus, HabitStatus, getTodayDate } from '@habits-coach/shared';
import * as habitsService from '../services/habits';

interface HabitsState {
  habits: Habit[];
  todayLogs: Map<string, HabitStatus>;
  isLoading: boolean;

  // Actions
  loadHabits: () => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Promise<void>;
  removeHabit: (habitId: string) => Promise<void>;
  updateHabit: (habitId: string, updates: Partial<Omit<Habit, 'id' | 'createdAt'>>) => Promise<void>;
  setHabitStatus: (habitId: string, status: HabitStatus) => Promise<void>;
  getHabitsWithStatus: () => HabitWithStatus[];
  clearHabits: () => void;
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  todayLogs: new Map(),
  isLoading: true,

  loadHabits: async () => {
    set({ isLoading: true });
    try {
      const [habits, todayLogs] = await Promise.all([
        habitsService.getHabits(),
        habitsService.getTodayLogs(),
      ]);
      set({ habits, todayLogs, isLoading: false });
    } catch (error) {
      console.error('Failed to load habits:', error);
      set({ isLoading: false });
    }
  },

  addHabit: async (habitData) => {
    try {
      const habit = await habitsService.addHabit(habitData);
      set((state) => ({ habits: [...state.habits, habit] }));
    } catch (error) {
      console.error('Failed to add habit:', error);
      throw error;
    }
  },

  removeHabit: async (habitId) => {
    try {
      await habitsService.removeHabit(habitId);
      set((state) => ({
        habits: state.habits.filter((h) => h.id !== habitId),
        todayLogs: new Map(
          [...state.todayLogs].filter(([id]) => id !== habitId)
        ),
      }));
    } catch (error) {
      console.error('Failed to remove habit:', error);
      throw error;
    }
  },

  updateHabit: async (habitId, updates) => {
    try {
      await habitsService.updateHabit(habitId, updates);
      set((state) => ({
        habits: state.habits.map((h) =>
          h.id === habitId ? { ...h, ...updates } : h
        ),
      }));
    } catch (error) {
      console.error('Failed to update habit:', error);
      throw error;
    }
  },

  setHabitStatus: async (habitId, status) => {
    try {
      const today = getTodayDate();
      await habitsService.setHabitStatus(habitId, today, status);
      set((state) => {
        const newLogs = new Map(state.todayLogs);
        newLogs.set(habitId, status);
        return { todayLogs: newLogs };
      });
    } catch (error) {
      console.error('Failed to set habit status:', error);
      throw error;
    }
  },

  getHabitsWithStatus: () => {
    const { habits, todayLogs } = get();
    return habits.map((habit) => ({
      ...habit,
      todayStatus: todayLogs.get(habit.id) || 'pending',
    }));
  },

  clearHabits: () => {
    set({ habits: [], todayLogs: new Map() });
  },
}));
