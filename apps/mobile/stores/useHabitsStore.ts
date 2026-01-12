import { create } from 'zustand';
import { Habit, HabitWithStatus, HabitStatus, getTodayDate } from '@habits-coach/shared';
import * as habitsService from '../services/habits';
import { notifyFirstSkip } from '../services/api';
import { getLast7Days } from '../utils/dateUtils';

interface HabitsState {
  habits: Habit[];
  selectedDate: string; // YYYY-MM-DD format
  dateLogs: Map<string, Map<string, HabitStatus>>; // date -> (habitId -> status)
  isLoading: boolean;

  // Actions
  loadHabits: () => Promise<void>;
  setSelectedDate: (date: string) => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Promise<void>;
  removeHabit: (habitId: string) => Promise<void>;
  updateHabit: (habitId: string, updates: Partial<Omit<Habit, 'id' | 'createdAt'>>) => Promise<void>;
  setHabitStatus: (habitId: string, status: HabitStatus) => Promise<void>;
  getHabitsWithStatus: () => HabitWithStatus[];
  clearHabits: () => void;
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  selectedDate: getTodayDate(),
  dateLogs: new Map(),
  isLoading: true,

  loadHabits: async () => {
    set({ isLoading: true });
    try {
      // Preload all 7 days shown in the mini-calendar
      const dates = getLast7Days().map((d) => d.date);

      const [habits, ...logsResults] = await Promise.all([
        habitsService.getHabits(),
        ...dates.map((date) => habitsService.getLogsForDate(date)),
      ]);

      const dateLogs = new Map<string, Map<string, HabitStatus>>();
      dates.forEach((date, index) => {
        dateLogs.set(date, logsResults[index]);
      });

      set({ habits, dateLogs, isLoading: false });
    } catch (error) {
      console.error('Failed to load habits:', error);
      set({ isLoading: false });
    }
  },

  setSelectedDate: async (date: string) => {
    const { dateLogs } = get();
    set({ selectedDate: date });

    // Load logs for this date if not cached
    if (!dateLogs.has(date)) {
      set({ isLoading: true });
      try {
        const logs = await habitsService.getLogsForDate(date);
        set((state) => {
          const newDateLogs = new Map(state.dateLogs);
          newDateLogs.set(date, logs);
          return { dateLogs: newDateLogs, isLoading: false };
        });
      } catch (error) {
        console.error('Failed to load logs for date:', error);
        set({ isLoading: false });
      }
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
      set((state) => {
        // Remove from all cached date logs
        const newDateLogs = new Map(state.dateLogs);
        for (const [date, logs] of newDateLogs) {
          if (logs.has(habitId)) {
            const newLogs = new Map(logs);
            newLogs.delete(habitId);
            newDateLogs.set(date, newLogs);
          }
        }
        return {
          habits: state.habits.filter((h) => h.id !== habitId),
          dateLogs: newDateLogs,
        };
      });
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
      const { selectedDate } = get();
      await habitsService.setHabitStatus(habitId, selectedDate, status);
      set((state) => {
        const newDateLogs = new Map(state.dateLogs);
        const currentLogs = newDateLogs.get(selectedDate) || new Map();
        const updatedLogs = new Map(currentLogs);
        updatedLogs.set(habitId, status);
        newDateLogs.set(selectedDate, updatedLogs);
        return { dateLogs: newDateLogs };
      });

      // Only notify backend for first-skip on today's date
      const today = getTodayDate();
      if (status === 'skipped' && selectedDate === today) {
        notifyFirstSkip(habitId);
      }
    } catch (error) {
      console.error('Failed to set habit status:', error);
      throw error;
    }
  },

  getHabitsWithStatus: () => {
    const { habits, selectedDate, dateLogs } = get();
    const currentLogs = dateLogs.get(selectedDate) || new Map();
    return habits.map((habit) => ({
      ...habit,
      todayStatus: currentLogs.get(habit.id) || 'pending',
    }));
  },

  clearHabits: () => {
    set({ habits: [], dateLogs: new Map(), selectedDate: getTodayDate() });
  },
}));
