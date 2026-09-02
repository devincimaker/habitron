import { create } from 'zustand';

interface TaskListsUiState {
  /**
   * The list the Tasks tab is showing. `null` means the Inbox, resolved at
   * read time — lists load async, so an id here could not be trusted at boot.
   */
  activeListId: string | null;
  isDrawerOpen: boolean;
  setActiveList: (listId: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  reset: () => void;
}

export const useTaskListsUiStore = create<TaskListsUiState>((set) => ({
  activeListId: null,
  isDrawerOpen: false,
  setActiveList: (listId) => set({ activeListId: listId }),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  reset: () => set({ activeListId: null, isDrawerOpen: false }),
}));
