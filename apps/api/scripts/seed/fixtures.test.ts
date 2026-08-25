import { describe, expect, it } from 'vitest';
import { buildFixtures } from './fixtures.js';

const TODAY = '2026-08-25';

describe('buildFixtures', () => {
  const fixtures = buildFixtures(TODAY);

  it('partitions the day the Calendar tab reads: 2 overdue, 2 open today, 2 completed today', () => {
    const overdue = fixtures.tasks.filter(
      (task) => task.status === 'open' && task.dueDate !== null && task.dueDate < TODAY && task.scheduledDate !== null
    );
    const openToday = fixtures.tasks.filter((task) => task.status === 'open' && task.scheduledDate === TODAY);
    const completedToday = fixtures.tasks.filter(
      (task) => task.status === 'completed' && task.scheduledDate === TODAY
    );

    expect(overdue.map((task) => task.title)).toEqual(['Renew car insurance', 'Call the dentist']);
    expect(openToday.map((task) => task.title)).toEqual(['Write weekly review', 'Buy oat milk']);
    expect(completedToday.map((task) => task.title)).toEqual(['Pay electricity bill', 'Book flights']);
  });

  it('leaves one open task on tomorrow and three undated rows for the Tasks tab', () => {
    const tomorrow = fixtures.tasks.filter((task) => task.scheduledDate === '2026-08-26');
    expect(tomorrow.map((task) => task.title)).toEqual(['Plan next sprint']);

    const undated = fixtures.tasks.filter((task) => task.dueDate === null && task.scheduledDate === null);
    expect(undated.map((task) => task.title)).toEqual([
      'Groceries',
      'Read 20 pages',
      'Cancel old subscription',
    ]);
    expect(fixtures.tasks.filter((task) => task.status === 'open')).toHaveLength(6);
    expect(fixtures.tasks.filter((task) => task.status === 'completed')).toHaveLength(4);
  });

  it('gives every completed task a completedAt and no open task one', () => {
    for (const task of fixtures.tasks) {
      if (task.status === 'completed') {
        expect(task.completedAt, task.title).toBeTruthy();
      } else {
        expect(task.completedAt, task.title).toBeUndefined();
      }
    }
  });

  it('logs only days before today, so today is still pending', () => {
    expect(fixtures.habitLogs).toHaveLength(13);
    for (const log of fixtures.habitLogs) {
      expect(log.date < TODAY, `${log.habit} ${log.date}`).toBe(true);
    }
    expect(fixtures.habitLogs.filter((log) => log.habit === 'Meditate')).toHaveLength(7);
  });

  it('names a section that exists for every habit', () => {
    const sections = new Set(fixtures.sections.map((section) => section.name));
    for (const habit of fixtures.habits) {
      expect(sections.has(habit.section), habit.name).toBe(true);
    }
  });

  it('holds no absolute date: a different today shifts every date by the same amount', () => {
    const later = buildFixtures('2026-09-04'); // ten days on

    expect(later.tasks.map((task) => task.dueDate)).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-04',
      '2026-09-04',
      '2026-09-04',
      '2026-09-05',
      null,
      null,
      null,
    ]);
    expect(later.habitLogs.every((log) => log.date < '2026-09-04')).toBe(true);
    expect(later.journal.map((entry) => entry.entryDate)).toEqual(['2026-09-03', '2026-09-01']);
    expect(later.habitStartDate).toBe('2026-08-05');
  });
});
