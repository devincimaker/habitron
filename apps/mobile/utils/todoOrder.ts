import type { Todo } from '@habits-coach/shared';
import type { TodoOrderUpdate } from '../services/todos';

/**
 * `position` is the one manual order: dense per user, written by every drop.
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
 * of the user's list (one Calendar day), so only their own slots change hands
 * and every task off screen keeps its position exactly. Only rows whose
 * position actually changes come back, so a drop where it started writes
 * nothing.
 */
export function redealTodoPositions(visible: Todo[], from: number, to: number): TodoOrderUpdate[] {
  if (from === to || !visible[from] || !visible[to]) return [];

  const slots = visible.map((todo) => todo.position).sort((a, b) => a - b);

  return moveItem(visible, from, to).flatMap((todo, index) =>
    todo.position === slots[index] ? [] : [{ id: todo.id, position: slots[index] }]
  );
}

export function applyTodoOrder(todos: Todo[], updates: TodoOrderUpdate[]): Todo[] {
  if (!updates.length) return todos;
  const positions = new Map(updates.map((update) => [update.id, update.position]));

  return todos.map((todo) => {
    const position = positions.get(todo.id);
    return position === undefined ? todo : { ...todo, position };
  });
}

/** A new task appends: one past the highest position the user has. */
export function nextTodoPosition(todos: Pick<Todo, 'position'>[]): number {
  return todos.reduce((next, todo) => Math.max(next, todo.position + 1), 0);
}
