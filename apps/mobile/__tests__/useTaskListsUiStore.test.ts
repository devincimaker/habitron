import { useTaskListsUiStore } from '../stores/useTaskListsUiStore';

describe('useTaskListsUiStore', () => {
  beforeEach(() => {
    useTaskListsUiStore.getState().reset();
  });

  it('starts on the Inbox (null) with the drawer closed', () => {
    expect(useTaskListsUiStore.getState().activeListId).toBeNull();
    expect(useTaskListsUiStore.getState().isDrawerOpen).toBe(false);
  });

  it('switches lists and back to the Inbox', () => {
    useTaskListsUiStore.getState().setActiveList('list-books');
    expect(useTaskListsUiStore.getState().activeListId).toBe('list-books');

    useTaskListsUiStore.getState().setActiveList(null);
    expect(useTaskListsUiStore.getState().activeListId).toBeNull();
  });

  it('reset closes the drawer and falls back to the Inbox', () => {
    useTaskListsUiStore.getState().setActiveList('list-books');
    useTaskListsUiStore.getState().openDrawer();

    useTaskListsUiStore.getState().reset();

    expect(useTaskListsUiStore.getState().activeListId).toBeNull();
    expect(useTaskListsUiStore.getState().isDrawerOpen).toBe(false);
  });
});
