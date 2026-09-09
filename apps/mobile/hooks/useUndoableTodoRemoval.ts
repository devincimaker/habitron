import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Todo } from '@habits-coach/shared';
import { useTodoPlanOutcomeSync } from './useTodoPlanOutcomeSync';
import { useTodosStore } from '../stores/useTodosStore';
import { useTodoRemovalStore } from '../stores/useTodoRemovalStore';
import { getTodoPlanOutcomeForStatus } from '../utils/todoPlanOutcome';

export function useUndoableTodoRemoval() {
  const syncTodoPlanOutcome = useTodoPlanOutcomeSync();
  const setTodoStatus = useTodosStore((state) => state.setTodoStatus);
  const stopTodoSeries = useTodosStore((state) => state.stopTodoSeries);
  const removedTodo = useTodoRemovalStore((state) => state.removedTodo);
  const setRemovedTodo = useTodoRemovalStore((state) => state.setRemovedTodo);
  const clearIfSame = useTodoRemovalStore((state) => state.clearIfSame);

  const removeOne = useCallback(
    (todo: Todo) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRemovedTodo(todo);

      void (async () => {
        try {
          await setTodoStatus(todo.id, 'canceled');
          await syncTodoPlanOutcome(todo.scheduledDate, todo.id, 'canceled');
        } catch (error) {
          console.warn('Failed to remove todo:', error);
          clearIfSame(todo.id);
          Alert.alert('Could not remove task', 'Please try again.');
        }
      })();
    },
    [clearIfSame, setRemovedTodo, setTodoStatus, syncTodoPlanOutcome]
  );

  /**
   * A repeating task asks how far the removal reaches. "All future" ends the
   * series first, so what is removed — and what undo brings back — is one
   * plain task.
   */
  const removeTodo = useCallback(
    (todo: Todo) => {
      if (!todo.seriesId) {
        removeOne(todo);
        return;
      }
      Alert.alert('Remove repeating task', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'This occurrence', onPress: () => removeOne(todo) },
        {
          text: 'This and all future',
          style: 'destructive',
          onPress: () => {
            void stopTodoSeries(todo.id)
              .then(() => removeOne({ ...todo, seriesId: undefined, seriesDate: undefined, repeat: undefined }))
              .catch((error: unknown) => {
                console.warn('Failed to stop the series:', error);
                Alert.alert('Could not remove task', 'Please try again.');
              });
          },
        },
      ]);
    },
    [removeOne, stopTodoSeries]
  );

  const undoRemoveTodo = useCallback(() => {
    if (!removedTodo) return;

    const previousStatus = removedTodo.status;
    setRemovedTodo(null);

    void (async () => {
      try {
        await setTodoStatus(removedTodo.id, previousStatus);
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
  }, [removedTodo, setRemovedTodo, setTodoStatus, syncTodoPlanOutcome]);

  const dismissRemovedTodo = useCallback(() => {
    setRemovedTodo(null);
  }, [setRemovedTodo]);

  return {
    removedTodo,
    removeTodo,
    undoRemoveTodo,
    dismissRemovedTodo,
  };
}
