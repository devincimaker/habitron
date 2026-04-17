import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Todo } from '@habits-coach/shared';
import { useTodoPlanOutcomeSync } from './useTodoPlanOutcomeSync';
import { useTodosStore } from '../stores/useTodosStore';
import { getTodoPlanOutcomeForStatus } from '../utils/todoPlanOutcome';

export function useUndoableTodoRemoval() {
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const setTodoStatusOptimistic = useTodosStore((state) => state.setTodoStatusOptimistic);
  const [removedTodo, setRemovedTodo] = useState<Todo | null>(null);

  const removeTodo = useCallback(
    (todo: Todo) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRemovedTodo(todo);

      void (async () => {
        try {
          await setTodoStatusOptimistic(todo.id, 'canceled');
          await syncTodoPlanOutcome(todo.scheduledDate, todo.id, 'canceled');
        } catch (error) {
          console.warn('Failed to remove todo:', error);
          setRemovedTodo((current) => (current?.id === todo.id ? null : current));
          Alert.alert('Could not remove task', 'Please try again.');
        }
      })();
    },
    [setTodoStatusOptimistic, syncTodoPlanOutcome]
  );

  const undoRemoveTodo = useCallback(() => {
    if (!removedTodo) return;

    const previousStatus = removedTodo.status;
    setRemovedTodo(null);

    void (async () => {
      try {
        await setTodoStatusOptimistic(removedTodo.id, previousStatus);
        await syncTodoPlanOutcome(
          removedTodo.scheduledDate,
          removedTodo.id,
          getTodoPlanOutcomeForStatus(previousStatus)
        );
      } catch (error) {
        console.warn('Failed to restore todo:', error);
        Alert.alert('Could not restore task', 'Please try again.');
      }
    })();
  }, [removedTodo, setTodoStatusOptimistic, syncTodoPlanOutcome]);

  const dismissRemovedTodo = useCallback(() => {
    setRemovedTodo(null);
  }, []);

  return {
    removedTodo,
    removeTodo,
    undoRemoveTodo,
    dismissRemovedTodo,
  };
}
