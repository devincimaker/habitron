import { create } from 'zustand';
import { Habit, HabitWithStatus, HabitStatus, getTodayDate } from '@habits-coach/shared';
import * as Sentry from '@sentry/react-native';
import * as habitsService from '../services/habits';
import { notifyFirstSkip } from '../services/api';
import { getLast7Days } from '../utils/dateUtils';
import { handleStoreAction } from './storeUtils';

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
    await handleStoreAction({
      action: async () => {
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

        return { habits, dateLogs };
      },
      onSuccess: ({ habits, dateLogs }) => set({ habits, dateLogs }),
      context: 'load habits',
      setState: (state) => set(state),
    });
  },

  setSelectedDate: async (date: string) => {
    const { dateLogs } = get();
    set({ selectedDate: date });

    // Load logs for this date if not cached
    if (!dateLogs.has(date)) {
      await handleStoreAction({
        action: async () => await habitsService.getLogsForDate(date),
        onSuccess: (logs) => {
          set((state) => {
            const newDateLogs = new Map(state.dateLogs);
            newDateLogs.set(date, logs);
            return { dateLogs: newDateLogs };
          });
        },
        context: 'load logs for date',
        setState: (state) => set(state),
      });
    }
  },

  addHabit: async (habitData) => {
    await handleStoreAction({
      action: async () => await habitsService.addHabit(habitData),
      onSuccess: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
      context: 'add habit',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
  },

  removeHabit: async (habitId) => {
    await handleStoreAction({
      action: async () => await habitsService.removeHabit(habitId),
      onSuccess: () => {
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
      },
      context: 'remove habit',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
  },

  updateHabit: async (habitId, updates) => {
    await handleStoreAction({
      action: async () => await habitsService.updateHabit(habitId, updates),
      onSuccess: () => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === habitId ? { ...h, ...updates } : h
          ),
        }));
      },
      context: 'update habit',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
  },

  setHabitStatus: async (habitId, status) => {
    await handleStoreAction({
      action: async () => {
        const { selectedDate } = get();
        await habitsService.setHabitStatus(habitId, selectedDate, status);
        return selectedDate;
      },
      onSuccess: (selectedDate) => {
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
      },
      onError: (error) => {
        Sentry.captureException(error, { tags: { feature: 'habits' } });
      },
      context: 'set habit status',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
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
