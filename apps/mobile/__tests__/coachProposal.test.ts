import type { CoachAction } from '@habits-coach/shared';
import { describeCoachAction } from '../utils/coachProposal';

describe('describeCoachAction', () => {
  it('falls back gracefully when a habit create action is missing a name', () => {
    const malformedAction = {
      entity: 'habit',
      operation: 'create',
      habit: {
        frequency: 'daily',
      },
    } as unknown as CoachAction;

    expect(describeCoachAction(malformedAction)).toBe('Create habit');
  });

  it('renders the habit name when it is present', () => {
    const action: CoachAction = {
      entity: 'habit',
      operation: 'create',
      habit: {
        name: 'Take creatine',
        frequency: 'daily',
      },
    };

    expect(describeCoachAction(action)).toBe('Create habit: Take creatine');
  });

  it('renders the archived habit name and details when context is available', () => {
    const action: CoachAction = {
      entity: 'habit',
      operation: 'archive',
      habitId: 'habit-1',
    };

    expect(
      describeCoachAction(action, {
        habits: [
          {
            id: 'habit-1',
            name: 'Take creatine',
            frequency: 'daily',
            timeOfDay: 'morning',
            active: true,
            createdAt: Date.now(),
          },
        ],
      })
    ).toBe('Archive habit: Take creatine (daily, morning)');
  });
});
