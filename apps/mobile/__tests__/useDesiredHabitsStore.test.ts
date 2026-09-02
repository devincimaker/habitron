import type { DesiredHabit } from '@habits-coach/shared';

jest.mock('../services/desiredHabits', () => ({
  getDesiredHabits: jest.fn(),
  addDesiredHabit: jest.fn(),
  updateDesiredHabit: jest.fn(),
  removeDesiredHabit: jest.fn(),
}));

import * as desiredHabitsService from '../services/desiredHabits';
import { useDesiredHabitsStore } from '../stores/useDesiredHabitsStore';

const existing: DesiredHabit = { id: 'desired-1', title: 'Swim', note: 'Mornings', createdAt: 1 };

describe('useDesiredHabitsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDesiredHabitsStore.setState({ desiredHabits: [existing], isLoading: false });
  });

  it('shows a new desired habit at once and resolves with the server row', async () => {
    let settle: (desired: DesiredHabit) => void = () => undefined;
    (desiredHabitsService.addDesiredHabit as jest.Mock).mockImplementation(
      () => new Promise<DesiredHabit>((resolve) => { settle = resolve; })
    );

    const pending = useDesiredHabitsStore.getState().addDesiredHabit({ title: 'Climb' });
    expect(useDesiredHabitsStore.getState().desiredHabits[1]).toMatchObject({ title: 'Climb' });

    const created: DesiredHabit = { id: 'desired-2', title: 'Climb', createdAt: 2 };
    settle(created);
    await expect(pending).resolves.toEqual(created);
    expect(useDesiredHabitsStore.getState().desiredHabits).toEqual([existing, created]);
  });

  it('drops a new desired habit when the write fails', async () => {
    (desiredHabitsService.addDesiredHabit as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(
      useDesiredHabitsStore.getState().addDesiredHabit({ title: 'Climb' })
    ).rejects.toThrow('offline');

    expect(useDesiredHabitsStore.getState().desiredHabits).toEqual([existing]);
  });

  it('applies an edit at once, clearing an empty note, and restores it on failure', async () => {
    (desiredHabitsService.updateDesiredHabit as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useDesiredHabitsStore
      .getState()
      .updateDesiredHabit(existing.id, { title: 'Swim laps', note: '' });
    expect(useDesiredHabitsStore.getState().desiredHabits[0]).toMatchObject({
      title: 'Swim laps',
      note: undefined,
    });

    await expect(pending).rejects.toThrow('offline');
    expect(useDesiredHabitsStore.getState().desiredHabits).toEqual([existing]);
  });

  it('removes at once and brings the row back on failure', async () => {
    (desiredHabitsService.removeDesiredHabit as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useDesiredHabitsStore.getState().removeDesiredHabit(existing.id);
    expect(useDesiredHabitsStore.getState().desiredHabits).toEqual([]);

    await expect(pending).rejects.toThrow('offline');
    expect(useDesiredHabitsStore.getState().desiredHabits).toEqual([existing]);
  });
});
