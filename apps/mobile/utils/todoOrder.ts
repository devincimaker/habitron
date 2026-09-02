import type { Todo } from '@habits-coach/shared';
import type { TodoOrderUpdate } from '../services/todos';

/**
 * `position` is the manual order, dense per list and written by every drop.
 * Creation breaks a tie so two rows that somehow share a position still have
 * one order on every screen.
 */
export function sortTodosByPosition<T extends Pick<Todo, 'position' | 'createdAt'>>(todos: T[]): T[] {
  return [...todos].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Moves the row at `from` to `to` and deals the positions the visible rows
 * already occupy back out in the new order. The visible rows may be a subset
 * of the user's tasks (one Calendar day), so only their own slots change hands
 * and every task off screen keeps its position exactly. Positions rank a task
 * within its list, so each list's slots are dealt back to that list's own rows
 * — a mixed-list view (a Calendar day) never leaks a position across lists.
 * Only rows whose position actually changes come back, so a drop where it
 * started writes nothing.
 */
export function redealTodoPositions(visible: Todo[], from: number, to: number): TodoOrderUpdate[] {
  if (from === to || !visible[from] || !visible[to]) return [];

  const slotsByList = new Map<string, number[]>();
  for (const todo of visible) {
    const slots = slotsByList.get(todo.listId) ?? [];
    slots.push(todo.position);
    slotsByList.set(todo.listId, slots);
  }
  for (const slots of slotsByList.values()) {
    slots.sort((a, b) => a - b);
  }

  const dealt = new Map<string, number>();
  return moveItem(visible, from, to).flatMap((todo) => {
    const index = dealt.get(todo.listId) ?? 0;
    dealt.set(todo.listId, index + 1);
    const slot = (slotsByList.get(todo.listId) as number[])[index];
    return todo.position === slot ? [] : [{ id: todo.id, position: slot }];
  });
}

export function applyTodoOrder(todos: Todo[], updates: TodoOrderUpdate[]): Todo[] {
  if (!updates.length) return todos;
  const positions = new Map(updates.map((update) => [update.id, update.position]));

  return todos.map((todo) => {
    const position = positions.get(todo.id);
    return position === undefined ? todo : { ...todo, position };
  });
}

/** A new task appends: one past the highest position in its list, so pass that list's tasks only. */
export function nextTodoPosition(todos: Pick<Todo, 'position'>[]): number {
  return todos.reduce((next, todo) => Math.max(next, todo.position + 1), 0);
}
