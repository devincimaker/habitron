import { Habit, HabitLogEntry } from '@habits-coach/shared';
import { useHabitsStore } from '../stores/useHabitsStore';
import * as habitsService from '../services/habits';

jest.mock('../services/habits', () => ({
  archiveHabit: jest.fn(),
  restoreHabit: jest.fn(),
  updateHabit: jest.fn(),
  setHabitLog: jest.fn(),
}));

jest.mock('../services/api', () => ({
  notifyFirstSkip: jest.fn(),
}));

jest.mock('../services/habitReminders', () => ({
  syncHabitReminders: jest.fn().mockResolvedValue(undefined),
}));

const today = '2026-04-09';
const createdAt = new Date('2026-04-01T09:00:00Z').getTime();

const baseHabit: Omit<Habit, 'id' | 'name'> = {
  frequency: 'daily',
  position: 0,
  startDate: '2026-04-01',
  goalType: 'boolean',
  checkInMode: 'auto',
  reminderTimes: [],
  constantReminder: false,
  autoPopupLog: false,
  active: true,
  createdAt,
};

const activeHabit: Habit = { ...baseHabit, id: 'habit-active', name: 'Read' };
const archivedHabit: Habit = { ...baseHabit, id: 'habit-archived', name: 'Stretch', active: false };
const dueDailyHabit: Habit = {
  ...baseHabit,
  id: 'habit-due-daily',
  name: 'Walk',
  weeklyDays: ['Thu'],
};
const offDayDailyHabit: Habit = {
  ...baseHabit,
  id: 'habit-off-day',
  name: 'Review budget',
  weeklyDays: ['Mon'],
};
const weeklyHabit: Habit = {
  ...baseHabit,
  id: 'habit-weekly',
  name: 'Strength',
  frequency: 'weekly',
  weeklyCount: 3,
};
const waterHabit: Habit = {
  ...baseHabit,
  id: 'habit-water',
  name: 'Water',
  goalType: 'quantity',
  targetAmount: 8,
  unit: 'Cup',
  recordIncrement: 2,
};

const completed: HabitLogEntry = { status: 'completed', amount: 0 };
const pending: HabitLogEntry = { status: 'pending', amount: 0 };

describe('useHabitsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useHabitsStore.setState({
      habits: [
        activeHabit,
        archivedHabit,
        dueDailyHabit,
        offDayDailyHabit,
        weeklyHabit,
        waterHabit,
      ],
      sections: [],
      selectedDate: today,
      dateLogs: new Map([
        [
          today,
          new Map<string, HabitLogEntry>([
            [activeHabit.id, completed],
            [archivedHabit.id, completed],
            [dueDailyHabit.id, pending],
            [weeklyHabit.id, completed],
            [waterHabit.id, { status: 'pending', amount: 4 }],
          ]),
        ],
      ]),
      isLoading: false,
    });
  });

  it('excludes archived and off-day habits from getHabitsWithStatus', () => {
    const habitsWithStatus = useHabitsStore.getState().getHabitsWithStatus();

    expect(habitsWithStatus).toEqual([
      { ...activeHabit, todayStatus: 'completed', todayAmount: 0 },
      { ...dueDailyHabit, todayStatus: 'pending', todayAmount: 0 },
      { ...weeklyHabit, todayStatus: 'completed', todayAmount: 0 },
      { ...waterHabit, todayStatus: 'pending', todayAmount: 4 },
    ]);
  });

  it('archives a habit without removing it from the store', async () => {
    const archivedResult = { ...activeHabit, active: false };
    (habitsService.archiveHabit as jest.Mock).mockResolvedValue(archivedResult);

    await useHabitsStore.getState().archiveHabit(activeHabit.id);

    expect(habitsService.archiveHabit).toHaveBeenCalledWith(activeHabit.id);
    expect(useHabitsStore.getState().habits[0]).toEqual(archivedResult);
  });

  it('restores a habit back into the active set', async () => {
    const restoredResult = { ...archivedHabit, active: true };
    (habitsService.restoreHabit as jest.Mock).mockResolvedValue(restoredResult);

    await useHabitsStore.getState().restoreHabit(archivedHabit.id);

    expect(habitsService.restoreHabit).toHaveBeenCalledWith(archivedHabit.id);
    expect(useHabitsStore.getState().habits[1]).toEqual(restoredResult);
  });

  it('records quantity progress and completes at the target', async () => {
    (habitsService.setHabitLog as jest.Mock).mockResolvedValue(undefined);

    await useHabitsStore.getState().setHabitAmount(waterHabit.id, 6);
    expect(habitsService.setHabitLog).toHaveBeenLastCalledWith(waterHabit.id, today, {
      status: 'pending',
      amount: 6,
    });

    await useHabitsStore.getState().setHabitAmount(waterHabit.id, 8);
    expect(habitsService.setHabitLog).toHaveBeenLastCalledWith(waterHabit.id, today, {
      status: 'completed',
      amount: 8,
    });

    const water = useHabitsStore
      .getState()
      .getHabitsWithStatus()
      .find((habit) => habit.id === waterHabit.id);
    expect(water).toMatchObject({ todayStatus: 'completed', todayAmount: 8 });
  });

  it('fills the target amount when a quantity habit is marked complete', async () => {
    (habitsService.setHabitLog as jest.Mock).mockResolvedValue(undefined);

    await useHabitsStore.getState().setHabitStatus(waterHabit.id, 'completed');

    expect(habitsService.setHabitLog).toHaveBeenCalledWith(waterHabit.id, today, {
      status: 'completed',
      amount: 8,
    });
  });

  it('merges partial coach edits onto the existing habit before saving', async () => {
    (habitsService.updateHabit as jest.Mock).mockImplementation(async (_id, draft) => ({
      ...activeHabit,
      ...draft,
    }));

    await useHabitsStore.getState().updateHabit(activeHabit.id, {
      frequency: 'interval',
      intervalDays: 3,
    });

    expect(habitsService.updateHabit).toHaveBeenCalledWith(
      activeHabit.id,
      expect.objectContaining({
        name: 'Read',
        frequency: 'interval',
        intervalDays: 3,
        weeklyDays: undefined,
        startDate: '2026-04-01',
        goalType: 'boolean',
        reminderTimes: [],
      })
    );
  });
});
