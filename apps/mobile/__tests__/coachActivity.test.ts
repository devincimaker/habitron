import { describeCoachActivity } from '../utils/coachActivity';

describe('describeCoachActivity', () => {
  it('describes known Habitron tools', () => {
    expect(describeCoachActivity('get_day_context')).toBe('Reading your day…');
    expect(describeCoachActivity('save_day_plan')).toBe('Saving your plan…');
  });

  it('falls back for unknown tools', () => {
    expect(describeCoachActivity('something_new')).toBe('Working…');
  });
});
