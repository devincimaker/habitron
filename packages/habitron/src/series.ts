import type { Task } from './db.js';

/**
 * One row per repeating task: its earliest occurrence among `tasks`. The day
 * packet and a plain listing want "Therapy" once, not eight Wednesdays of it;
 * a date filter wants every occurrence and does not go through here.
 */
export function collapseSeriesOccurrences<T extends Task>(tasks: T[]): T[] {
  const next = new Map<string, T>();
  for (const task of tasks) {
    if (!task.seriesId) continue;
    const current = next.get(task.seriesId);
    if (!current || (task.scheduledDate ?? '') < (current.scheduledDate ?? '')) {
      next.set(task.seriesId, task);
    }
  }
  return tasks.filter((task) => !task.seriesId || next.get(task.seriesId) === task);
}
