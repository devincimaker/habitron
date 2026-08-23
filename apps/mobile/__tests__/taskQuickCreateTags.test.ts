jest.mock('@habits-coach/shared', () => ({
  getTodayDate: () => '2026-04-16',
}));

import {
  buildQuickCreateTodoDraft,
  getActiveInlineTagContext,
  getInlineTagName,
  getInlineScheduledTimeContext,
  getQuickCreateTextSegments,
  insertTagTriggerAtSelection,
  replaceActiveInlineTagContext,
  stripInlineScheduledTimeToken,
  stripInlineTagTokens,
} from '../utils/taskQuickCreateTags';

describe('taskQuickCreateTags', () => {
  it('uses the first inline tag as the category and preserves its casing', () => {
    expect(getInlineTagName('Write launch copy #Brand #girls')).toBe('Brand');
  });

  it('does not treat hashtags inside words as the category', () => {
    expect(getInlineTagName('Study C# basics and ship #backend')).toBe('backend');
  });

  it('strips inline tags from the saved title and collapses whitespace', () => {
    expect(stripInlineTagTokens('Write launch copy   #brand\n#girls today')).toBe(
      'Write launch copy today'
    );
  });

  it('builds a todo draft with the parsed category', () => {
    expect(buildQuickCreateTodoDraft('Write launch copy #brand #girls')).toEqual({
      title: 'Write launch copy',
      tagName: 'brand',
    });
  });

  it('extracts a standalone inline scheduled time token', () => {
    expect(getInlineScheduledTimeContext('Need Tomas algo 20:00 #brand')).toEqual({
      start: 16,
      end: 21,
      raw: '20:00',
      normalizedTime: '20:00',
    });
  });

  it('strips the inline scheduled time token from the saved title', () => {
    expect(stripInlineScheduledTimeToken('Need Tomas algo 20:00 #brand')).toBe(
      'Need Tomas algo #brand'
    );
  });

  it('builds a todo draft with both the parsed category and scheduled time', () => {
    expect(buildQuickCreateTodoDraft('Need Tomas algo 20:00 #brand')).toEqual({
      title: 'Need Tomas algo',
      tagName: 'brand',
      scheduledDate: '2026-04-16',
      scheduledTime: '20:00',
    });
  });

  it('parses a parenthesised duration into the estimate and strips it from the title', () => {
    expect(buildQuickCreateTodoDraft('Renew car insurance (1h 50m) 14:00 #admin')).toEqual({
      title: 'Renew car insurance',
      tagName: 'admin',
      scheduledDate: '2026-04-16',
      scheduledTime: '14:00',
      estimateMinutes: 110,
    });
  });

  it('highlights both the scheduled time and the estimate', () => {
    expect(getQuickCreateTextSegments('Swim (45m) at 18:30')).toEqual([
      { text: 'Swim ', kind: 'default' },
      { text: '(45m)', kind: 'estimate' },
      { text: ' at ', kind: 'default' },
      { text: '18:30', kind: 'scheduledTime' },
    ]);
  });

  it('uses the provided default scheduled date for calendar quick create', () => {
    expect(
      buildQuickCreateTodoDraft('Write launch copy #brand', '2026-04-20')
    ).toEqual({
      title: 'Write launch copy',
      tagName: 'brand',
      scheduledDate: '2026-04-20',
    });
  });

  it('returns null when the composer only contains tags', () => {
    expect(buildQuickCreateTodoDraft('#brand #girls')).toBeNull();
  });

  it('returns the active inline tag context for a partial tag token', () => {
    expect(
      getActiveInlineTagContext('Write launch copy #br', {
        start: 22,
        end: 22,
      })
    ).toEqual({
      start: 18,
      end: 21,
      raw: '#br',
      query: 'br',
    });
  });

  it('inserts the tag trigger with a leading space when needed', () => {
    expect(
      insertTagTriggerAtSelection('Write launch copy', {
        start: 17,
        end: 17,
      })
    ).toEqual({
      text: 'Write launch copy #',
      selection: { start: 19, end: 19 },
    });
  });

  it('replaces the active tag token with a selected suggestion and appends a space', () => {
    expect(
      replaceActiveInlineTagContext(
        'Write launch copy #br',
        {
          start: 18,
          end: 21,
          raw: '#br',
          query: 'br',
        },
        'brand'
      )
    ).toEqual({
      text: 'Write launch copy #brand ',
      selection: { start: 25, end: 25 },
    });
  });

  it('builds text segments that mark the assigned scheduled time for highlighting', () => {
    expect(getQuickCreateTextSegments('Need Tomas algo 20:00 #brand')).toEqual([
      { text: 'Need Tomas algo ', kind: 'default' },
      { text: '20:00', kind: 'scheduledTime' },
      { text: ' #brand', kind: 'default' },
    ]);
  });
});
