const syncHabitReminders = jest.fn(async () => undefined);
const syncRoutineAlarms = jest.fn(async () => undefined);

jest.mock('../services/habitReminders', () => ({ syncHabitReminders }));
jest.mock('../services/routineAlarms', () => ({ syncRoutineAlarms }));

import type { Habit, HabitSection } from '@habits-coach/shared';
import { syncHabitSchedules } from '../services/habitSchedules';

const sections: HabitSection[] = [
  { id: 'morning', name: 'Morning', sortOrder: 0, alarmEnabled: true, alarmByDay: { Mon: '06:30' } },
];
const habits: Habit[] = [];

describe('syncHabitSchedules', () => {
  beforeEach(() => jest.clearAllMocks());

  // Reminders and alarms go stale for the same reasons, so the store has one
  // call to remember. A wrapper that quietly dropped one of them would look
  // exactly like a working app until an alarm failed to ring.
  it('runs both planners', async () => {
    await syncHabitSchedules(habits, sections, new Map());

    expect(syncHabitReminders).toHaveBeenCalledTimes(1);
    expect(syncRoutineAlarms).toHaveBeenCalledTimes(1);
  });

  it('passes each planner what it needs', async () => {
    const logs = new Map();
    await syncHabitSchedules(habits, sections, logs);

    expect(syncHabitReminders).toHaveBeenCalledWith(habits, logs);
    expect(syncRoutineAlarms).toHaveBeenCalledWith(sections, habits, expect.any(Date));
  });
});
