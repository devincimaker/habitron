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
import {
  applyHabitDraft,
  buildOptimisticHabit,
  buildOptimisticSection,
  withLog,
  withoutHabitLogs,
  type DateLogs,
} from '../utils/habitOptimistic';
import { applyHabitOrder } from '../utils/habitOrder';
import {
  isHabitDueOnDate,
  resolveLogForAmount,
  resolveLogForStatus,
} from '../utils/habitSchedule';

/**
 * Every write here is optimistic: the store shows the change before the
 * network call, swaps the server row in when it lands, and puts the old state
 * back if it fails. Callers alert on the rejection; the store never does.
 */
interface HabitsState {
  habits: Habit[];
  sections: HabitSection[];
  selectedDate: string; // YYYY-MM-DD format
  dateLogs: DateLogs; // date -> (habitId -> log)
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

function replaceHabit(habits: Habit[], habitId: string, next: Habit): Habit[] {
  return habits.map((habit) => (habit.id === habitId ? next : habit));
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

      const dateLogs: DateLogs = new Map();
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
    const optimistic = buildOptimisticHabit(get().habits, draft);
    set((state) => ({ habits: [...state.habits, optimistic] }));
    void syncSchedules(get);

    try {
      const habit = await habitsService.addHabit(draft);
      set((state) => ({ habits: replaceHabit(state.habits, optimistic.id, habit) }));
      void syncSchedules(get);
      return habit;
    } catch (error) {
      set((state) => ({ habits: state.habits.filter((habit) => habit.id !== optimistic.id) }));
      void syncSchedules(get);
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
    const { habits, dateLogs } = get();
    set({
      habits: habits.filter((habit) => habit.id !== habitId),
      dateLogs: withoutHabitLogs(dateLogs, habitId),
    });
    void syncSchedules(get);

    try {
      await habitsService.removeHabit(habitId);
    } catch (error) {
      set({ habits, dateLogs });
      void syncSchedules(get);
      throw error;
    }
  },

  updateHabit: async (habitId, changes) => {
    const current = get().habits.find((habit) => habit.id === habitId);
    if (!current) {
      throw new Error(`Habit ${habitId} not found`);
    }

    const draft = { ...habitToDraft(current), ...changes };
    set((state) => ({ habits: replaceHabit(state.habits, habitId, applyHabitDraft(current, draft)) }));
    void syncSchedules(get);

    try {
      const updatedHabit = await habitsService.updateHabit(habitId, withHabitDraftDefaults(draft));
      set((state) => ({ habits: replaceHabit(state.habits, habitId, updatedHabit) }));
      void syncSchedules(get);
      return updatedHabit;
    } catch (error) {
      set((state) => ({ habits: replaceHabit(state.habits, habitId, current) }));
      void syncSchedules(get);
      throw error;
    }
  },

  archiveHabit: (habitId) => setActive(set, get, habitId, false),

  restoreHabit: (habitId) => setActive(set, get, habitId, true),

  addSection: async (name) => {
    const optimistic = buildOptimisticSection(get().sections, name);
    set((state) => ({ sections: [...state.sections, optimistic] }));

    try {
      const section = await habitsService.addSection(name, optimistic.sortOrder);
      set((state) => ({
        sections: state.sections.map((current) =>
          current.id === optimistic.id ? section : current
        ),
      }));
      return section;
    } catch (error) {
      set((state) => ({
        sections: state.sections.filter((current) => current.id !== optimistic.id),
      }));
      throw error;
    }
  },

  removeSection: async (sectionId) => {
    const { sections, habits } = get();
    set({
      sections: sections.filter((section) => section.id !== sectionId),
      habits: habits.map((habit) =>
        habit.sectionId === sectionId ? { ...habit, sectionId: undefined } : habit
      ),
    });
    void syncSchedules(get);

    try {
      await habitsService.removeSection(sectionId);
    } catch (error) {
      set({ sections, habits });
      void syncSchedules(get);
      throw error;
    }
  },

  updateSection: async (sectionId, draft) => {
    const current = get().sections.find((section) => section.id === sectionId);
    if (!current) {
      throw new Error(`Section ${sectionId} not found`);
    }

    const optimistic: HabitSection = { ...current, ...draft, name: draft.name.trim() };
    set((state) => ({
      sections: state.sections.map((section) => (section.id === sectionId ? optimistic : section)),
    }));
    void syncSchedules(get);

    try {
      const section = await habitsService.updateSection(sectionId, draft);
      set((state) => ({
        sections: state.sections.map((item) => (item.id === sectionId ? section : item)),
      }));
      void syncSchedules(get);
      return section;
    } catch (error) {
      // The write may have got as far as clearing the old alarm rows, so the
      // server is the only honest source of what the week is now.
      await get().loadHabits();
      throw error;
    }
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

type Set = (partial: Partial<HabitsState> | ((state: HabitsState) => Partial<HabitsState>)) => void;

/** Archive and restore are the same write with the flag flipped. */
async function setActive(
  set: Set,
  get: () => HabitsState,
  habitId: string,
  active: boolean
): Promise<Habit> {
  const current = get().habits.find((habit) => habit.id === habitId);
  if (!current) {
    throw new Error(`Habit ${habitId} not found`);
  }

  set((state) => ({ habits: replaceHabit(state.habits, habitId, { ...current, active }) }));
  void syncSchedules(get);

  try {
    const habit = active
      ? await habitsService.restoreHabit(habitId)
      : await habitsService.archiveHabit(habitId);
    set((state) => ({ habits: replaceHabit(state.habits, habitId, habit) }));
    void syncSchedules(get);
    return habit;
  } catch (error) {
    set((state) => ({ habits: replaceHabit(state.habits, habitId, current) }));
    void syncSchedules(get);
    throw error;
  }
}

async function writeLog(habitId: string, entry: HabitLogEntry): Promise<void> {
  const { selectedDate, dateLogs } = useHabitsStore.getState();
  const previous = dateLogs.get(selectedDate)?.get(habitId);
  useHabitsStore.setState({ dateLogs: withLog(dateLogs, selectedDate, habitId, entry) });

  try {
    await habitsService.setHabitLog(habitId, selectedDate, entry);

    const today = getTodayDate();
    if (selectedDate === today) {
      if (entry.status === 'skipped') {
        notifyFirstSkip(habitId);
      }
      // Reminders only: a check-in is what silences the rest of today's
      // notifications for that habit. It cannot change the alarm plan, which is
      // read from the routines' weeks alone — re-planning here would cancel and
      // re-schedule every AlarmKit alarm on every tap.
      const { habits, dateLogs: current } = useHabitsStore.getState();
      void syncHabitReminders(habits, current.get(today) ?? new Map());
    }
  } catch (error) {
    console.error('Failed to set habit log:', error);
    Sentry.captureException(error, { tags: { feature: 'habits' } });
    useHabitsStore.setState((state) => ({
      dateLogs: withLog(state.dateLogs, selectedDate, habitId, previous),
    }));
    throw error;
  }
}
