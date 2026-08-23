import { create } from 'zustand';
import {
  Habit,
  HabitDraft,
  HabitLogEntry,
  HabitSection,
  HabitStatus,
  HabitWithStatus,
  getTodayDate,
  habitToDraft,
  withHabitDraftDefaults,
} from '@habits-coach/shared';
import * as Sentry from '@sentry/react-native';
import * as habitsService from '../services/habits';
import { notifyFirstSkip } from '../services/api';
import { syncHabitReminders } from '../services/habitReminders';
import { getLast7Days } from '../utils/dateUtils';
import {
  isHabitDueOnDate,
  resolveLogForAmount,
  resolveLogForStatus,
} from '../utils/habitSchedule';

interface HabitsState {
  habits: Habit[];
  sections: HabitSection[];
  selectedDate: string; // YYYY-MM-DD format
  dateLogs: Map<string, Map<string, HabitLogEntry>>; // date -> (habitId -> log)
  isLoading: boolean;

  // Actions
  loadHabits: () => Promise<void>;
  setSelectedDate: (date: string) => Promise<void>;
  addHabit: (draft: HabitDraft) => Promise<Habit>;
  removeHabit: (habitId: string) => Promise<void>;
  updateHabit: (habitId: string, changes: Partial<HabitDraft>) => Promise<Habit>;
  archiveHabit: (habitId: string) => Promise<Habit>;
  restoreHabit: (habitId: string) => Promise<Habit>;
  addSection: (name: string) => Promise<HabitSection>;
  removeSection: (sectionId: string) => Promise<void>;
  setHabitStatus: (habitId: string, status: HabitStatus) => Promise<void>;
  setHabitAmount: (habitId: string, amount: number) => Promise<void>;
  getHabitsWithStatus: () => HabitWithStatus[];
  clearHabits: () => void;
}

const EMPTY_LOG: HabitLogEntry = { status: 'pending', amount: 0 };

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  sections: [],
  selectedDate: getTodayDate(),
  dateLogs: new Map(),
  isLoading: true,

  loadHabits: async () => {
    set({ isLoading: true });
    try {
      // Preload all 7 days shown in the mini-calendar
      const dates = getLast7Days().map((d) => d.date);

      const [habits, sections, ...logsResults] = await Promise.all([
        habitsService.getHabits(),
        habitsService.getSections(),
        ...dates.map((date) => habitsService.getLogsForDate(date)),
      ]);

      const dateLogs = new Map<string, Map<string, HabitLogEntry>>();
      dates.forEach((date, index) => {
        dateLogs.set(date, logsResults[index]);
      });

      set({ habits, sections, dateLogs, isLoading: false });
      void syncHabitReminders(habits, dateLogs.get(getTodayDate()) ?? new Map());
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

  addHabit: async (draft) => {
    try {
      const habit = await habitsService.addHabit(draft);
      set((state) => ({ habits: [...state.habits, habit] }));
      void syncHabitReminders(get().habits, get().dateLogs.get(getTodayDate()) ?? new Map());
      return habit;
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
      void syncHabitReminders(get().habits, get().dateLogs.get(getTodayDate()) ?? new Map());
    } catch (error) {
      console.error('Failed to remove habit:', error);
      throw error;
    }
  },

  updateHabit: async (habitId, changes) => {
    try {
      const current = get().habits.find((habit) => habit.id === habitId);
      if (!current) {
        throw new Error(`Habit ${habitId} not found`);
      }

      const draft = withHabitDraftDefaults({ ...habitToDraft(current), ...changes });
      const updatedHabit = await habitsService.updateHabit(habitId, draft);
      set((state) => ({
        habits: state.habits.map((h) =>
          h.id === habitId ? updatedHabit : h
        ),
      }));
      void syncHabitReminders(get().habits, get().dateLogs.get(getTodayDate()) ?? new Map());
      return updatedHabit;
    } catch (error) {
      console.error('Failed to update habit:', error);
      throw error;
    }
  },

  archiveHabit: async (habitId) => {
    try {
      const archivedHabit = await habitsService.archiveHabit(habitId);
      set((state) => ({
        habits: state.habits.map((habit) =>
          habit.id === habitId ? archivedHabit : habit
        ),
      }));
      void syncHabitReminders(get().habits, get().dateLogs.get(getTodayDate()) ?? new Map());
      return archivedHabit;
    } catch (error) {
      console.error('Failed to archive habit:', error);
      throw error;
    }
  },

  restoreHabit: async (habitId) => {
    try {
      const restoredHabit = await habitsService.restoreHabit(habitId);
      set((state) => ({
        habits: state.habits.map((habit) =>
          habit.id === habitId ? restoredHabit : habit
        ),
      }));
      void syncHabitReminders(get().habits, get().dateLogs.get(getTodayDate()) ?? new Map());
      return restoredHabit;
    } catch (error) {
      console.error('Failed to restore habit:', error);
      throw error;
    }
  },

  addSection: async (name) => {
    const { sections } = get();
    const section = await habitsService.addSection(name, sections.length);
    set({ sections: [...sections, section] });
    return section;
  },

  removeSection: async (sectionId) => {
    await habitsService.removeSection(sectionId);
    set((state) => ({
      sections: state.sections.filter((section) => section.id !== sectionId),
      habits: state.habits.map((habit) =>
        habit.sectionId === sectionId ? { ...habit, sectionId: undefined } : habit
      ),
    }));
  },

  setHabitStatus: async (habitId, status) => {
    const habit = get().habits.find((candidate) => candidate.id === habitId);
    if (!habit) return;
    await writeLog(habitId, resolveLogForStatus(habit, status));
  },

  setHabitAmount: async (habitId, amount) => {
    const habit = get().habits.find((candidate) => candidate.id === habitId);
    if (!habit) return;
    await writeLog(habitId, resolveLogForAmount(habit, amount));
  },

  getHabitsWithStatus: () => {
    const { habits, selectedDate, dateLogs } = get();
    const currentLogs = dateLogs.get(selectedDate) || new Map<string, HabitLogEntry>();
    return habits
      .filter((habit) => isHabitDueOnDate(habit, selectedDate))
      .map((habit) => {
        const log = currentLogs.get(habit.id) ?? EMPTY_LOG;
        return { ...habit, todayStatus: log.status, todayAmount: log.amount };
      });
  },

  clearHabits: () => {
    set({ habits: [], sections: [], dateLogs: new Map(), selectedDate: getTodayDate() });
  },
}));

async function writeLog(habitId: string, entry: HabitLogEntry): Promise<void> {
  const { selectedDate } = useHabitsStore.getState();
  try {
    await habitsService.setHabitLog(habitId, selectedDate, entry);
    useHabitsStore.setState((state) => {
      const newDateLogs = new Map(state.dateLogs);
      const currentLogs = newDateLogs.get(selectedDate) || new Map<string, HabitLogEntry>();
      const updatedLogs = new Map(currentLogs);
      updatedLogs.set(habitId, entry);
      newDateLogs.set(selectedDate, updatedLogs);
      return { dateLogs: newDateLogs };
    });

    const today = getTodayDate();
    if (selectedDate === today) {
      if (entry.status === 'skipped') {
        notifyFirstSkip(habitId);
      }
      const { habits, dateLogs } = useHabitsStore.getState();
      void syncHabitReminders(habits, dateLogs.get(today) ?? new Map());
    }
  } catch (error) {
    console.error('Failed to set habit log:', error);
    Sentry.captureException(error, { tags: { feature: 'habits' } });
    throw error;
  }
}
