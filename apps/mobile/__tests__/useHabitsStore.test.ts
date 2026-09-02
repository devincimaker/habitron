import { Habit, HabitLogEntry } from '@habits-coach/shared';
import { useHabitsStore } from '../stores/useHabitsStore';
import * as habitsService from '../services/habits';

jest.mock('../services/habits', () => ({
  addHabit: jest.fn(),
  archiveHabit: jest.fn(),
  restoreHabit: jest.fn(),
  removeHabit: jest.fn(),
  updateHabit: jest.fn(),
  addSection: jest.fn(),
  setHabitLog: jest.fn(),
}));

jest.mock('../services/habitSchedules', () => ({
  syncHabitSchedules: jest.fn().mockResolvedValue(undefined),
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

  it('shows a check-in before the log is written', async () => {
    let settle: () => void = () => undefined;
    (habitsService.setHabitLog as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => { settle = resolve; })
    );

    const pending = useHabitsStore.getState().setHabitStatus(dueDailyHabit.id, 'completed');

    expect(useHabitsStore.getState().dateLogs.get(today)?.get(dueDailyHabit.id)).toEqual({
      status: 'completed',
      amount: 0,
    });

    settle();
    await pending;
  });

  it('puts the old log back when the write fails', async () => {
    (habitsService.setHabitLog as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(
      useHabitsStore.getState().setHabitAmount(waterHabit.id, 8)
    ).rejects.toThrow('offline');

    expect(useHabitsStore.getState().dateLogs.get(today)?.get(waterHabit.id)).toEqual({
      status: 'pending',
      amount: 4,
    });
  });

  it('removes a never-logged habit\'s failed check-in rather than leaving a blank', async () => {
    (habitsService.setHabitLog as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(
      useHabitsStore.getState().setHabitStatus(offDayDailyHabit.id, 'completed')
    ).rejects.toThrow('offline');

    expect(useHabitsStore.getState().dateLogs.get(today)?.has(offDayDailyHabit.id)).toBe(false);
  });

  it('archives at once and restores the habit if the write fails', async () => {
    (habitsService.archiveHabit as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useHabitsStore.getState().archiveHabit(activeHabit.id);
    expect(useHabitsStore.getState().habits[0]).toMatchObject({ active: false });

    await expect(pending).rejects.toThrow('offline');
    expect(useHabitsStore.getState().habits[0]).toEqual(activeHabit);
  });

  it('shows a new habit at the bottom of its routine and swaps in the server row', async () => {
    useHabitsStore.setState({ habits: [{ ...activeHabit, sectionId: 'morning', position: 3 }] });
    let settle: (habit: Habit) => void = () => undefined;
    (habitsService.addHabit as jest.Mock).mockImplementation(
      () => new Promise<Habit>((resolve) => { settle = resolve; })
    );

    const pending = useHabitsStore.getState().addHabit({
      name: 'Stretch',
      frequency: 'daily',
      startDate: today,
      goalType: 'boolean',
      checkInMode: 'auto',
      sectionId: 'morning',
      reminderTimes: [],
      constantReminder: false,
    });

    expect(useHabitsStore.getState().habits[1]).toMatchObject({
      name: 'Stretch',
      sectionId: 'morning',
      position: 4,
      active: true,
    });

    const created: Habit = { ...baseHabit, id: 'habit-stretch', name: 'Stretch', sectionId: 'morning', position: 4 };
    settle(created);
    await expect(pending).resolves.toEqual(created);
    expect(useHabitsStore.getState().habits[1]).toEqual(created);
  });

  it('drops a new habit when the write fails', async () => {
    (habitsService.addHabit as jest.Mock).mockRejectedValue(new Error('offline'));
    const before = useHabitsStore.getState().habits;

    await expect(
      useHabitsStore.getState().addHabit({
        name: 'Stretch',
        frequency: 'daily',
        startDate: today,
        goalType: 'boolean',
        checkInMode: 'auto',
        reminderTimes: [],
        constantReminder: false,
      })
    ).rejects.toThrow('offline');

    expect(useHabitsStore.getState().habits).toEqual(before);
  });

  it('brings a deleted habit and its logs back when the delete fails', async () => {
    (habitsService.removeHabit as jest.Mock).mockRejectedValue(new Error('offline'));
    const before = useHabitsStore.getState();

    const pending = useHabitsStore.getState().removeHabit(activeHabit.id);
    expect(useHabitsStore.getState().habits.some((habit) => habit.id === activeHabit.id)).toBe(false);
    expect(useHabitsStore.getState().dateLogs.get(today)?.has(activeHabit.id)).toBe(false);

    await expect(pending).rejects.toThrow('offline');
    expect(useHabitsStore.getState().habits).toEqual(before.habits);
    expect(useHabitsStore.getState().dateLogs.get(today)?.get(activeHabit.id)).toEqual(completed);
  });

  it('shows a new section at once and swaps in the server row', async () => {
    const created = { id: 'section-evening', name: 'Evening', sortOrder: 0, alarmEnabled: false, alarmByDay: {} };
    let settle: (section: typeof created) => void = () => undefined;
    (habitsService.addSection as jest.Mock).mockImplementation(
      () => new Promise<typeof created>((resolve) => { settle = resolve; })
    );

    const pending = useHabitsStore.getState().addSection('Evening');
    expect(useHabitsStore.getState().sections).toEqual([
      expect.objectContaining({ name: 'Evening', sortOrder: 0 }),
    ]);

    settle(created);
    await expect(pending).resolves.toEqual(created);
    expect(useHabitsStore.getState().sections).toEqual([created]);
  });
});
