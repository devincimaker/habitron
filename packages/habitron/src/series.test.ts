import { describe, expect, it } from 'vitest';
import type { Task } from './db.js';
import { collapseSeriesOccurrences } from './series.js';

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    listId: 'inbox',
    title: id,
    status: 'open',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...extra,
  };
}

describe('collapseSeriesOccurrences', () => {
  it('keeps the earliest occurrence per series and every plain task', () => {
    const tasks = [
      task('plain'),
      task('wed-2', { seriesId: 's1', scheduledDate: '2026-09-16' }),
      task('wed-1', { seriesId: 's1', scheduledDate: '2026-09-09' }),
      task('mon-1', { seriesId: 's2', scheduledDate: '2026-09-14' }),
    ];
    expect(collapseSeriesOccurrences(tasks).map((t) => t.id)).toEqual(['plain', 'wed-1', 'mon-1']);
  });
});
