import type { Todo } from '@habits-coach/shared';
import {
  applyTodoOrder,
  moveItem,
  nextTodoPosition,
  redealTodoPositions,
  sortTodosByPosition,
} from '../utils/todoOrder';

function todo(id: string, position: number, scheduledDate?: string, createdAt = 0): Todo {
  return {
    id,
    title: id,
    status: 'open',
    position,
    listId: 'list-1',
    scheduledDate,
    createdAt,
    updatedAt: createdAt,
  };
}

const ids = (todos: Todo[]) => todos.map((item) => item.id);

describe('sortTodosByPosition', () => {
  it('orders by position regardless of input order', () => {
    expect(ids(sortTodosByPosition([todo('c', 2), todo('a', 0), todo('b', 1)]))).toEqual(['a', 'b', 'c']);
  });

  it('breaks a shared position by creation', () => {
    expect(ids(sortTodosByPosition([todo('late', 0, undefined, 20), todo('early', 0, undefined, 10)]))).toEqual([
      'early',
      'late',
    ]);
  });

  it('does not mutate its input', () => {
    const input = [todo('b', 1), todo('a', 0)];
    sortTodosByPosition(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });
});

describe('moveItem', () => {
  it('moves an item down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
});

describe('redealTodoPositions', () => {
  it('deals the same slots back out in the new order', () => {
    const visible = [todo('a', 0), todo('b', 1), todo('c', 2)];

    expect(redealTodoPositions(visible, 2, 0)).toEqual([
      { id: 'c', position: 0 },
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('writes only the rows whose position changed', () => {
    const visible = [todo('a', 0), todo('b', 1), todo('c', 2), todo('d', 3)];

    expect(redealTodoPositions(visible, 1, 2)).toEqual([
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('reorders one day without touching the positions of any other day', () => {
    // Global order: A(4) B(5) C(7) D(9); 5, 6 and 8 belong to other days.
    const other = [todo('b', 5, 'mon'), todo('x', 6, 'wed'), todo('y', 8, 'wed')];
    const tuesday = [todo('a', 4, 'tue'), todo('c', 7, 'tue'), todo('d', 9, 'tue')];
    const all = [...tuesday, ...other];

    const updates = redealTodoPositions(tuesday, 1, 0);

    expect(updates).toEqual([
      { id: 'c', position: 4 },
      { id: 'a', position: 7 },
    ]);

    const next = applyTodoOrder(all, updates);
    const nextTuesday = sortTodosByPosition(next.filter((item) => item.scheduledDate === 'tue'));
    expect(ids(nextTuesday)).toEqual(['c', 'a', 'd']);
    expect(nextTuesday.map((item) => item.position)).toEqual([4, 7, 9]);
    for (const item of other) {
      // Same object, not just equal: nothing off screen was rewritten.
      expect(next.find((candidate) => candidate.id === item.id)).toBe(item);
    }
  });

  it('writes nothing for a drop where it started', () => {
    expect(redealTodoPositions([todo('a', 0), todo('b', 1)], 1, 1)).toEqual([]);
  });

  it('writes nothing for an index off the list', () => {
    expect(redealTodoPositions([todo('a', 0), todo('b', 1)], 0, 5)).toEqual([]);
    expect(redealTodoPositions([todo('a', 0), todo('b', 1)], -1, 0)).toEqual([]);
  });

  it('is a no-op when the visible rows share one position', () => {
    // Only a direct writer can produce this; the migration and every insert keep positions unique.
    expect(redealTodoPositions([todo('a', 0), todo('b', 0)], 1, 0)).toEqual([]);
  });
});

describe('applyTodoOrder', () => {
  it('returns the same array when there is nothing to apply', () => {
    const todos = [todo('a', 0)];
    expect(applyTodoOrder(todos, [])).toBe(todos);
  });

  it('applies positions by id and keeps every other row', () => {
    const untouched = todo('b', 1);
    const next = applyTodoOrder([todo('a', 0), untouched], [{ id: 'a', position: 9 }]);
    expect(next[0].position).toBe(9);
    expect(next[1]).toBe(untouched);
  });
});

describe('nextTodoPosition', () => {
  it('appends after the highest position', () => {
    expect(nextTodoPosition([todo('a', 3), todo('b', 7), todo('c', 5)])).toBe(8);
  });

  it('starts at zero for an empty list', () => {
    expect(nextTodoPosition([])).toBe(0);
  });
});
