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

const activeHabit: Habit = {
  id: 'habit-active',
  name: 'Read',
  frequency: 'daily',
  timeOfDay: 'evening',
  active: true,
  createdAt: Date.now(),
};

const archivedHabit: Habit = {
  id: 'habit-archived',
  name: 'Stretch',
  frequency: 'daily',
  timeOfDay: 'morning',
  active: false,
  createdAt: Date.now(),
};

describe('useHabitsStore archive behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useHabitsStore.setState({
      habits: [activeHabit, archivedHabit],
      selectedDate: today,
      dateLogs: new Map([
        [
          today,
          new Map([
            [activeHabit.id, 'completed'],
            [archivedHabit.id, 'completed'],
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
    ]);
  });
});
