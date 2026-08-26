import { describe, expect, it } from 'vitest';
import { buildScorecard } from './scorecard.js';
import type { HabitForDay } from './context.js';
import type { Task } from './db.js';
import type { DailyPlanItem, DailyPlanItemOutcome } from '@habits-coach/shared';

function planItem(outcome: DailyPlanItemOutcome, titleSnapshot: string): DailyPlanItem {
  return {
    id: titleSnapshot,
    planId: 'plan-1',
    itemType: 'todo',
    titleSnapshot,
    isOptional: false,
    position: 0,
    outcome,
  };
}

function habit(
  dueOnDate: boolean,
  statusOnDate: HabitForDay['statusOnDate'],
  extra: Partial<HabitForDay> = {}
): HabitForDay {
  return {
    id: `${dueOnDate}-${statusOnDate}-${extra.name ?? ''}`,
    name: 'Meditate',
    frequency: 'daily',
    startDate: '2026-08-01',
    goalType: 'boolean',
    checkInMode: 'auto',
    constantReminder: false,
    autoPopupLog: false,
    reminderTimes: [],
    active: true,
    dueOnDate,
    statusOnDate,
    completedThisWeek: 0,
    completedLast14Days: 0,
    ...extra,
  };
}

function task(fields: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'completed',
    createdAt: '2026-08-25T08:00:00Z',
    updatedAt: '2026-08-25T08:00:00Z',
    ...fields,
  };
}

describe('buildScorecard', () => {
  const habits = [habit(true, 'completed'), habit(true, 'pending'), habit(false, 'completed')];

  it('counts plan items by what they actually became', () => {
    const scorecard = buildScorecard({
      planItems: [
        planItem('completed_as_planned', 'Ship the migration'),
        planItem('completed_after_adjustment', 'Call Ana'),
        planItem('deferred', 'Invoice'),
        planItem('not_done', 'Read 10 pages'),
        planItem('removed', 'Buy a desk'),
        planItem('planned', 'Stretch'),
      ],
      habits: [],
      completedTasks: [],
    });

    expect(scorecard.plan).toEqual({
      items: 6,
      done: 2,
      dropped: 1,
      // An item still sitting at `planned` is residue too: at review time,
      // unresolved and not-done are the same thing to ask about.
      residue: 3,
      residueTitles: ['Invoice', 'Read 10 pages', 'Stretch'],
    });
  });

  // Notes are guidance text with nothing to do. Counting one would report a
  // miss that cannot happen, then ask the user to reschedule a sentence.
  it('leaves plan notes out of the counts entirely', () => {
    const scorecard = buildScorecard({
      planItems: [
        planItem('completed_as_planned', 'Ship the migration'),
        { ...planItem('planned', 'Protect the morning for deep work'), itemType: 'note' },
      ],
      habits: [],
      completedTasks: [],
    });

    expect(scorecard.plan).toEqual({
      items: 1,
      done: 1,
      dropped: 0,
      residue: 0,
      residueTitles: [],
    });
  });

  it('reads no plan as null rather than an empty one', () => {
    const scorecard = buildScorecard({ planItems: null, habits, completedTasks: [] });

    expect(scorecard.plan).toBeNull();
  });

  it('counts only habits due on the date', () => {
    expect(buildScorecard({ planItems: null, habits, completedTasks: [] }).habits).toEqual({
      due: 2,
      logged: 1,
    });
  });

  // isHabitDue surfaces a weekly-count habit every day so the app can show week
  // progress. Counting that as due would report a miss on a day it owed nothing.
  it('reports a flexible weekly habit as week progress, not as due today', () => {
    const gym = habit(true, 'pending', {
      name: 'Gym',
      frequency: 'weekly',
      weeklyCount: 3,
      completedThisWeek: 2,
    });
    const scorecard = buildScorecard({
      planItems: null,
      habits: [gym, habit(true, 'completed', { name: 'Meditate' })],
      completedTasks: [],
    });

    expect(scorecard.habits).toEqual({ due: 1, logged: 1 });
    expect(scorecard.habitsThisWeek).toEqual([{ name: 'Gym', completed: 2, target: 3 }]);
  });

  it('keeps a weekday-pinned weekly habit in the daily count', () => {
    const scorecard = buildScorecard({
      planItems: null,
      habits: [habit(true, 'pending', { name: 'Run', frequency: 'weekly', weeklyDays: ['Tue'] })],
      completedTasks: [],
    });

    expect(scorecard.habits).toEqual({ due: 1, logged: 0 });
    expect(scorecard.habitsThisWeek).toEqual([]);
  });

  it('totals estimate and actual separately, and minutes per category', () => {
    const scorecard = buildScorecard({
      planItems: null,
      habits: [],
      completedTasks: [
        task({ estimateMinutes: 60, actualMinutes: 90, tag: { id: 't1', name: 'Work' } }),
        task({ estimateMinutes: 30, actualMinutes: 30, tag: { id: 't1', name: 'Work' } }),
        task({ estimateMinutes: 45, tag: { id: 't2', name: 'Health' } }),
        task({ actualMinutes: 20 }),
      ],
    });

    // trackedMinutes is what minutesByTag sums, so the card's total and its
    // per-category breakdown cannot contradict each other.
    expect(scorecard.tasks).toEqual({
      completed: 4,
      estimatedMinutes: 135,
      actualMinutes: 140,
      trackedMinutes: 185,
    });
    // Minutes fall back to the estimate when nothing was logged, and an
    // untagged task still has to land somewhere.
    expect(scorecard.minutesByTag).toEqual({ Work: 120, Health: 45, untagged: 20 });
    expect(Object.values(scorecard.minutesByTag).reduce((a, b) => a + b, 0)).toBe(
      scorecard.tasks.trackedMinutes
    );
  });
});
