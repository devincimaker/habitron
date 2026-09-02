import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import type { Todo, TodoDraft, TodoStatus } from '@habits-coach/shared';
import { useTodoPlanOutcomeSync } from './useTodoPlanOutcomeSync';
import { useUndoableTodoRemoval } from './useUndoableTodoRemoval';
import { useTodosStore } from '../stores/useTodosStore';
import type { TaskStatusToggleOptions } from '../components/TaskRow';
import { getTodoPlanOutcomeForStatus } from '../utils/todoPlanOutcome';

export interface TaskSheetActions {
  /**
   * Persists one field. The sheet has no Save, so every edit comes through
   * here. Pass a function when the change is derived from the task's current
   * value — it is called when the write's turn comes, not when it is queued.
   */
  save: (changes: Partial<TodoDraft> | (() => Partial<TodoDraft>)) => void;
  /** `options` carries the minutes a completed task actually took. */
  toggleStatus: (options?: TaskStatusToggleOptions) => void;
  setChecklistItemDone: (itemId: string, done: boolean) => void;
  remove: () => void;
}

/**
 * Every write the task sheet makes, with the two things a caller keeps
 * forgetting: the day plan's outcome follows the task, and a failed write says
 * so rather than looking like it worked.
 */
export function useTaskSheetActions(todo: Todo | null, onRemoved: () => void): TaskSheetActions {
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const setTodoStatus = useTodosStore((state) => state.setTodoStatus);
  const setItemDone = useTodosStore((state) => state.setChecklistItemDone);
  const { removeTodo } = useUndoableTodoRemoval();
  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(
    (changes: Partial<TodoDraft> | (() => Partial<TodoDraft>)) => {
      if (!todo) return;
      const todoId = todo.id;

      // Saves run one at a time. The store shows each edit optimistically, but
      // every write still ends by swapping the server's row in — so two in
      // flight together let the older response overwrite the newer edit, and
      // two checklist edits, which each send the entire list, lose whichever
      // item the other just added. Queueing is also what makes the function
      // form of `changes` reliable: it reads the task after the previous write
      // landed.
      queue.current = queue.current.then(async () => {
        const previousScheduledDate = useTodosStore
          .getState()
          .todos.find((item) => item.id === todoId)?.scheduledDate;

        try {
          const updated = await updateTodo(
            todoId,
            typeof changes === 'function' ? changes() : changes
          );
          // Moving a task off a planned day marks that day's plan deferred —
          // the same rule the editor form followed.
          if (previousScheduledDate && updated.scheduledDate !== previousScheduledDate) {
            await syncTodoPlanOutcome(previousScheduledDate, updated.id, 'deferred');
          }
        } catch (error) {
          console.warn('Failed to save task:', error);
          Alert.alert('Could not save the task', 'Please try again.');
        }
      });
    },
    [syncTodoPlanOutcome, todo, updateTodo]
  );

  const toggleStatus = useCallback(
    (options?: TaskStatusToggleOptions) => {
    if (!todo) return;
    const nextStatus: TodoStatus = todo.status === 'completed' ? 'open' : 'completed';

    void (async () => {
      try {
        const updated = await setTodoStatus(todo.id, nextStatus, options);
        await syncTodoPlanOutcome(
          todo.scheduledDate,
          updated.id,
          getTodoPlanOutcomeForStatus(nextStatus)
        );
      } catch (error) {
        console.warn('Failed to update todo status:', error);
        Alert.alert('Could not update task', 'Please try again.');
      }
    })();
    },
    [setTodoStatus, syncTodoPlanOutcome, todo]
  );

  const setChecklistItemDone = useCallback(
    (itemId: string, done: boolean) => {
      if (!todo) return;
      void setItemDone(todo.id, itemId, done).catch((error: unknown) => {
        console.warn('Failed to update checklist item:', error);
      });
    },
    [setItemDone, todo]
  );

  const remove = useCallback(() => {
    if (!todo) return;
    // The snackbar belongs to the screen underneath, so leave first and let the
    // shared pending removal put it up there.
    onRemoved();
    removeTodo(todo);
  }, [onRemoved, removeTodo, todo]);

  return { save, toggleStatus, setChecklistItemDone, remove };
}
