import {
  changesPropagateToSeries,
  describeTaskRepeat,
  matchesRepeatRule,
  nextRepeatDate,
} from '../utils/todoRepeat';

// 2026-09-09 is a Wednesday.
describe('todoRepeat', () => {
  it('finds the first date a weekly rule falls on, from a given day', () => {
    expect(nextRepeatDate({ frequency: 'weekly', weekdays: [1] }, '2026-09-09')).toBe('2026-09-14');
    expect(nextRepeatDate({ frequency: 'weekly', weekdays: [3] }, '2026-09-09')).toBe('2026-09-09');
  });

  it('counts biweekly from the start week, Sunday-based', () => {
    const rule = { frequency: 'biweekly' as const, weekdays: [1, 3] };
    expect(matchesRepeatRule(rule, '2026-09-09', '2026-09-14')).toBe(false);
    expect(matchesRepeatRule(rule, '2026-09-09', '2026-09-21')).toBe(true);
    expect(matchesRepeatRule(rule, '2026-09-09', '2026-09-23')).toBe(true);
    expect(matchesRepeatRule(rule, '2026-09-09', '2026-09-30')).toBe(false);
  });

  it('clamps a monthly rule to shorter months', () => {
    const rule = { frequency: 'monthly' as const, weekdays: [] };
    expect(matchesRepeatRule(rule, '2026-01-31', '2026-02-28')).toBe(true);
    expect(matchesRepeatRule(rule, '2026-01-31', '2026-03-31')).toBe(true);
    expect(matchesRepeatRule(rule, '2026-01-31', '2026-03-30')).toBe(false);
  });

  it('stops at the end date', () => {
    const rule = { frequency: 'weekly' as const, weekdays: [3], endDate: '2026-09-10' };
    expect(nextRepeatDate(rule, '2026-09-10')).toBeUndefined();
  });

  it('describes rules in words', () => {
    expect(describeTaskRepeat({ frequency: 'weekly', weekdays: [3] })).toBe('Every Wednesday');
    expect(describeTaskRepeat({ frequency: 'weekly', weekdays: [1, 3] })).toBe('Every Mon and Wed');
    expect(describeTaskRepeat({ frequency: 'weekly', weekdays: [1, 3, 5] })).toBe('Every Mon, Wed and Fri');
    expect(describeTaskRepeat({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Every weekday');
    expect(describeTaskRepeat({ frequency: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
    expect(describeTaskRepeat({ frequency: 'biweekly', weekdays: [3] })).toBe('Every 2 weeks on Wednesday');
    expect(describeTaskRepeat({ frequency: 'monthly', weekdays: [] }, '2026-09-09')).toBe('Monthly on the 9th');
    expect(describeTaskRepeat({ frequency: 'monthly', weekdays: [] }, '2026-09-22')).toBe('Monthly on the 22nd');
    expect(describeTaskRepeat({ frequency: 'weekly', weekdays: [3], endDate: '2026-12-15' })).toBe(
      'Every Wednesday until Dec 15'
    );
  });

  it('propagates field edits but not date moves', () => {
    expect(changesPropagateToSeries({ title: 'Therapy' }, '2026-09-09')).toBe(true);
    expect(changesPropagateToSeries({ scheduledDate: '2026-09-10', scheduledTime: '11:00' }, '2026-09-09')).toBe(false);
    expect(changesPropagateToSeries({ scheduledDate: '2026-09-09', scheduledTime: '12:00' }, '2026-09-09')).toBe(true);
    expect(changesPropagateToSeries({ repeat: null }, '2026-09-09')).toBe(false);
  });
});
