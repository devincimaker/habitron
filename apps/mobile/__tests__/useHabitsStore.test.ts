import { Habit } from '@habits-coach/shared';
import { useHabitsStore } from '../stores/useHabitsStore';
import * as habitsService from '../services/habits';

jest.mock('../services/habits', () => ({
  archiveHabit: jest.fn(),
  restoreHabit: jest.fn(),
}));

jest.mock('../services/api', () => ({
  notifyFirstSkip: jest.fn(),
}));

const today = '2026-04-09';
const createdAt = new Date('2026-04-01T09:00:00Z').getTime();

const activeHabit: Habit = {
  id: 'habit-active',
  name: 'Read',
  frequency: 'daily',
  timeOfDay: 'evening',
  active: true,
  createdAt,
};

const archivedHabit: Habit = {
  id: 'habit-archived',
  name: 'Stretch',
  frequency: 'daily',
  timeOfDay: 'morning',
  active: false,
  createdAt,
};

const dueDailyHabit: Habit = {
  id: 'habit-due-daily',
  name: 'Walk',
  frequency: 'daily',
  weeklyDays: ['Thu'],
  active: true,
  createdAt,
};

const offDayDailyHabit: Habit = {
  id: 'habit-off-day',
  name: 'Review budget',
  frequency: 'daily',
  weeklyDays: ['Mon'],
  active: true,
  createdAt,
};

const weeklyHabit: Habit = {
  id: 'habit-weekly',
  name: 'Strength',
  frequency: 'weekly',
  weeklyCount: 3,
  active: true,
  createdAt,
};

describe('useHabitsStore archive behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useHabitsStore.setState({
      habits: [
        activeHabit,
        archivedHabit,
        dueDailyHabit,
        offDayDailyHabit,
        weeklyHabit,
      ],
      selectedDate: today,
      dateLogs: new Map([
        [
          today,
          new Map([
            [activeHabit.id, 'completed'],
            [archivedHabit.id, 'completed'],
            [dueDailyHabit.id, 'pending'],
            [weeklyHabit.id, 'completed'],
          ]),
        ],
      ]),
      isLoading: false,
    });
  });

  it('excludes archived habits from getHabitsWithStatus', () => {
    const habitsWithStatus = useHabitsStore.getState().getHabitsWithStatus();

    expect(habitsWithStatus).toEqual([
      {
        ...activeHabit,
        todayStatus: 'completed',
      },
      {
        ...dueDailyHabit,
        todayStatus: 'pending',
      },
      {
        ...weeklyHabit,
        todayStatus: 'completed',
      },
    ]);
  });

  it('archives a habit without removing it from the store', async () => {
    const archivedResult = {
      ...activeHabit,
      active: false,
    };
    (habitsService.archiveHabit as jest.Mock).mockResolvedValue(archivedResult);

    await useHabitsStore.getState().archiveHabit(activeHabit.id);

    expect(habitsService.archiveHabit).toHaveBeenCalledWith(activeHabit.id);
    expect(useHabitsStore.getState().habits).toEqual([
      archivedResult,
      archivedHabit,
      dueDailyHabit,
      offDayDailyHabit,
      weeklyHabit,
    ]);
  });

  it('restores a habit back into the active set', async () => {
    const restoredResult = {
      ...archivedHabit,
      active: true,
    };
    (habitsService.restoreHabit as jest.Mock).mockResolvedValue(restoredResult);

    await useHabitsStore.getState().restoreHabit(archivedHabit.id);

    expect(habitsService.restoreHabit).toHaveBeenCalledWith(archivedHabit.id);
    expect(useHabitsStore.getState().habits).toEqual([
      activeHabit,
      restoredResult,
      dueDailyHabit,
      offDayDailyHabit,
      weeklyHabit,
    ]);
  });
});
