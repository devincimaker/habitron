import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Todo } from '@habits-coach/shared';
import { useTodoPlanOutcomeSync } from './useTodoPlanOutcomeSync';
import { useTodosStore } from '../stores/useTodosStore';

/** Moves a task to another day (or off the calendar) and keeps its daily plan in sync. */
export function useTodoReschedule() {
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();

  return useCallback(
    async (todo: Todo, nextDate?: string) => {
      if (todo.scheduledDate === nextDate) return;

      void Haptics.selectionAsync();
      const previousScheduledDate = todo.scheduledDate;

      try {
        // A time with no date would snap the task back to today, so both clear together.
        await updateTodo(
          todo.id,
          nextDate
            ? { scheduledDate: nextDate, scheduledTime: todo.scheduledTime }
            : { scheduledDate: undefined, scheduledTime: undefined }
        );
        await syncTodoPlanOutcome(previousScheduledDate, todo.id, 'deferred');
      } catch (error) {
        console.warn('Failed to reschedule todo:', error);
        Alert.alert('Could not move task', 'Please try again.');
      }
    },
    [syncTodoPlanOutcome, updateTodo]
  );
}
