import { create } from 'zustand';
import {
  Habit,
  HabitDraft,
  HabitLogEntry,
  HabitSection,
  HabitSectionDraft,
  HabitStatus,
  HabitWithStatus,
  getTodayDate,
  habitToDraft,
  withHabitDraftDefaults,
} from '@habits-coach/shared';
import * as Sentry from '@sentry/react-native';
import * as habitsService from '../services/habits';
import { notifyFirstSkip } from '../services/api';
import { syncHabitSchedules } from '../services/habitSchedules';
import { syncHabitReminders } from '../services/habitReminders';
import { getLast7Days } from '../utils/dateUtils';
import { applyHabitOrder } from '../utils/habitOrder';
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
  reorderHabits: (updates: habitsService.HabitOrderUpdate[]) => Promise<void>;
  updateHabit: (habitId: string, changes: Partial<HabitDraft>) => Promise<Habit>;
  archiveHabit: (habitId: string) => Promise<Habit>;
  restoreHabit: (habitId: string) => Promise<Habit>;
  addSection: (name: string) => Promise<HabitSection>;
  updateSection: (sectionId: string, draft: HabitSectionDraft) => Promise<HabitSection>;
  removeSection: (sectionId: string) => Promise<void>;
  setHabitStatus: (habitId: string, status: HabitStatus) => Promise<void>;
  setHabitAmount: (habitId: string, amount: number) => Promise<void>;
  getHabitsWithStatus: () => HabitWithStatus[];
  clearHabits: () => void;
}

const EMPTY_LOG: HabitLogEntry = { status: 'pending', amount: 0 };

/**
 * Re-plan reminders and routine alarms from the store as it stands now. Every
 * mutation ends with this, so it reads the state back rather than taking it —
 * the caller has just written it.
 */
function syncSchedules(get: () => HabitsState): Promise<void> {
  const { habits, sections, dateLogs } = get();
  return syncHabitSchedules(habits, sections, dateLogs.get(getTodayDate()) ?? new Map());
}

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
      void syncSchedules(get);
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
      void syncSchedules(get);
      return habit;
    } catch (error) {
      console.error('Failed to add habit:', error);
      throw error;
    }
  },

  reorderHabits: async (updates) => {
    if (!updates.length) return;
    // Optimistic: the list has already animated the drop, so the order it shows
    // has to survive the round trip rather than wait for it.
    const previous = get().habits;
    set({ habits: applyHabitOrder(previous, updates) });

    try {
      await habitsService.reorderHabits(updates);
    } catch (error) {
      console.error('Failed to reorder habits:', error);
      await get().loadHabits();
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
      void syncSchedules(get);
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
      void syncSchedules(get);
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
      void syncSchedules(get);
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
      void syncSchedules(get);
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
    void syncSchedules(get);
  },

  updateSection: async (sectionId, draft) => {
    const section = await habitsService.updateSection(sectionId, draft);
    set((state) => ({
      sections: state.sections.map((current) => (current.id === sectionId ? section : current)),
    }));
    void syncSchedules(get);
    return section;
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
      // Reminders only: a check-in is what silences the rest of today's
      // notifications for that habit. It cannot change the alarm plan, which is
      // read from the routines' weeks alone — re-planning here would cancel and
      // re-schedule every AlarmKit alarm on every tap.
      const { habits, dateLogs } = useHabitsStore.getState();
      void syncHabitReminders(habits, dateLogs.get(today) ?? new Map());
    }
  } catch (error) {
    console.error('Failed to set habit log:', error);
    Sentry.captureException(error, { tags: { feature: 'habits' } });
    throw error;
  }
}
