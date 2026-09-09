import type { Todo } from '@habits-coach/shared';

function compareOccurrences(a: Todo, b: Todo): number {
  return (
    (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') ||
    (a.seriesDate ?? '').localeCompare(b.seriesDate ?? '')
  );
}

/**
 * One row per repeating task: its earliest occurrence among `todos`, so a
 * list that is not about dates (the Tasks tab) shows "Therapy" once, not
 * eight Wednesdays of it. Plain tasks pass through in their order.
 */
export function collapseSeriesOccurrences(todos: Todo[]): Todo[] {
  const next = new Map<string, Todo>();
  for (const todo of todos) {
    if (!todo.seriesId) continue;
    const current = next.get(todo.seriesId);
    if (!current || compareOccurrences(todo, current) < 0) next.set(todo.seriesId, todo);
  }
  return todos.filter((todo) => !todo.seriesId || next.get(todo.seriesId) === todo);
}
