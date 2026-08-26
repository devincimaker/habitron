import type { Priority } from '@habits-coach/shared';

export interface TodoPriorityOption {
  value: Priority;
  label: string;
  /** The flag in the quick-create sheet and the open checkbox on the row. */
  color: string;
}

/** One table for every surface that names a priority: the editor chips, the
 * quick-create flag and the task row all read from here. */
export const TODO_PRIORITY_OPTIONS: TodoPriorityOption[] = [
  { value: 1, label: 'Urgent', color: '#F44336' },
  { value: 2, label: 'High', color: '#FF9800' },
  { value: 3, label: 'Normal', color: '#2F80ED' },
  { value: 4, label: 'Low', color: '#4DB6AC' },
];

export function getTodoPriorityOption(
  priority: Priority | undefined
): TodoPriorityOption | undefined {
  return TODO_PRIORITY_OPTIONS.find((option) => option.value === priority);
}
