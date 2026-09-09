import type { Todo } from '@habits-coach/shared';
import { collapseSeriesOccurrences } from '../utils/todoSeries';

function todo(id: string, extra: Partial<Todo> = {}): Todo {
  return {
    id,
    title: id,
    status: 'open',
    position: 0,
    listId: 'inbox',
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

describe('collapseSeriesOccurrences', () => {
  it('keeps one occurrence per series, the earliest, and every plain task', () => {
    const rows = [
      todo('plain'),
      todo('wed-2', { seriesId: 's1', seriesDate: '2026-09-16', scheduledDate: '2026-09-16' }),
      todo('wed-1', { seriesId: 's1', seriesDate: '2026-09-09', scheduledDate: '2026-09-09' }),
      todo('mon-1', { seriesId: 's2', seriesDate: '2026-09-14', scheduledDate: '2026-09-14' }),
    ];
    expect(collapseSeriesOccurrences(rows).map((t) => t.id)).toEqual(['plain', 'wed-1', 'mon-1']);
  });

  it('follows a moved occurrence by its scheduled date', () => {
    const rows = [
      todo('a', { seriesId: 's1', seriesDate: '2026-09-09', scheduledDate: '2026-09-20' }),
      todo('b', { seriesId: 's1', seriesDate: '2026-09-16', scheduledDate: '2026-09-16' }),
    ];
    expect(collapseSeriesOccurrences(rows).map((t) => t.id)).toEqual(['b']);
  });
});
