import { create } from 'zustand';
import type { Todo } from '@habits-coach/shared';

interface TodoRemovalState {
  /** The task waiting behind an undo snackbar, or null when none is. */
  removedTodo: Todo | null;
  setRemovedTodo: (todo: Todo | null) => void;
  /** Clears only if it is still this task — a second removal owns the slot. */
  clearIfSame: (todoId: string) => void;
}

/**
 * One pending removal for the whole app.
 *
 * The task detail sheet is its own route, so a task deleted there has to reach
 * the snackbar rendered by the tab underneath it. Component state cannot cross
 * that boundary; this can.
 */
export const useTodoRemovalStore = create<TodoRemovalState>((set) => ({
  removedTodo: null,

  setRemovedTodo: (todo) => set({ removedTodo: todo }),

  clearIfSame: (todoId) =>
    set((state) => (state.removedTodo?.id === todoId ? { removedTodo: null } : state)),
}));
