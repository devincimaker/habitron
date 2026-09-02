import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import type { TodoList } from '@habits-coach/shared';
import { useTodosStore } from '../stores/useTodosStore';
import { useTaskListsUiStore } from '../stores/useTaskListsUiStore';
import { getTodoTagColor } from '../utils/todoTagColors';

/** Create, rename and delete lists from the drawer, with the prompts they need. */
export function useTaskListActions() {
  const { createTodoList, updateTodoList, deleteTodoList, getOpenTodoCountsByList } =
    useTodosStore();
  const { activeListId, setActiveList } = useTaskListsUiStore();

  const createList = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const list = await createTodoList(trimmed, getTodoTagColor(trimmed));
        setActiveList(list.id);
      } catch (error) {
        console.warn('Failed to create list:', error);
        Alert.alert('Could not create list', 'Please try again.');
      }
    },
    [createTodoList, setActiveList]
  );

  const promptCreateList = useCallback(() => {
    Alert.prompt('New list', 'Name for the new list', (text) => {
      void createList(text ?? '');
    });
  }, [createList]);

  const renameList = useCallback(
    async (list: TodoList, name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === list.name) return;
      try {
        await updateTodoList(list.id, { name: trimmed });
      } catch (error) {
        console.warn('Failed to rename list:', error);
        Alert.alert('Could not rename list', 'Please try again.');
      }
    },
    [updateTodoList]
  );

  const confirmDeleteList = useCallback(
    (list: TodoList) => {
      const count = getOpenTodoCountsByList()[list.id] ?? 0;
      const consequence =
        count === 0
          ? 'It has no open tasks.'
          : count === 1
            ? 'Its 1 open task moves to Inbox.'
            : `Its ${count} open tasks move to Inbox.`;

      Alert.alert(`Delete "${list.name}"?`, consequence, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteTodoList(list.id);
                if (activeListId === list.id) setActiveList(null);
              } catch (error) {
                console.warn('Failed to delete list:', error);
                Alert.alert('Could not delete list', 'Please try again.');
              }
            })();
          },
        },
      ]);
    },
    [activeListId, deleteTodoList, getOpenTodoCountsByList, setActiveList]
  );

  const promptRenameList = useCallback(
    (list: TodoList) => {
      Alert.prompt(
        'Rename list',
        undefined,
        (text) => {
          void renameList(list, text ?? '');
        },
        'plain-text',
        list.name
      );
    },
    [renameList]
  );

  const showListActions = useCallback(
    (list: TodoList) => {
      if (list.isInbox) return;

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Rename', 'Delete'],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 2,
            title: list.name,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) promptRenameList(list);
            if (buttonIndex === 2) confirmDeleteList(list);
          }
        );
      } else {
        Alert.alert(list.name, undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Rename', onPress: () => promptRenameList(list) },
          { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteList(list) },
        ]);
      }
    },
    [confirmDeleteList, promptRenameList]
  );

  return { promptCreateList, showListActions };
}
