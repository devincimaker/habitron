/**
 * Utility for handling async store actions with loading state and error handling.
 * This wraps common patterns used across Zustand stores to reduce code duplication.
 */

interface StoreActionOptions<TResult> {
  /** The async action to execute */
  action: () => Promise<TResult>;
  /** Callback invoked with the result on success */
  onSuccess: (result: TResult) => void;
  /** Callback invoked on error (if not provided, error is only logged) */
  onError?: (error: unknown) => void;
  /** Context string for error logging (e.g., 'load habits') */
  context: string;
  /** Whether to set loading state (default: true) */
  setLoading?: boolean;
  /** Loading state key to use (default: 'isLoading') */
  loadingKey?: 'isLoading' | 'isLoadingDetail';
  /** Whether to rethrow errors after logging (default: false) */
  rethrow?: boolean;
  /** Function to set store state */
  setState: (state: Record<string, boolean>) => void;
}

/**
 * Executes an async store action with consistent loading state and error handling.
 *
 * @example
 * // With loading state management
 * loadHabits: async () => {
 *   await handleStoreAction({
 *     action: async () => await habitsService.getHabits(),
 *     onSuccess: (habits) => set({ habits }),
 *     context: 'load habits',
 *     setState: (state) => set(state),
 *   });
 * }
 *
 * @example
 * // Without loading state, with error rethrow
 * addHabit: async (habitData) => {
 *   await handleStoreAction({
 *     action: async () => await habitsService.addHabit(habitData),
 *     onSuccess: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
 *     context: 'add habit',
 *     setLoading: false,
 *     rethrow: true,
 *     setState: () => {},
 *   });
 * }
 */
export async function handleStoreAction<TResult>({
  action,
  onSuccess,
  onError,
  context,
  setLoading = true,
  loadingKey = 'isLoading',
  rethrow = false,
  setState,
}: StoreActionOptions<TResult>): Promise<void> {
  if (setLoading) {
    setState({ [loadingKey]: true });
  }

  try {
    const result = await action();
    onSuccess(result);
    if (setLoading) {
      setState({ [loadingKey]: false });
    }
  } catch (error) {
    console.error(`Failed to ${context}:`, error);
    if (setLoading) {
      setState({ [loadingKey]: false });
    }
    if (onError) {
      onError(error);
    }
    if (rethrow) {
      throw error;
    }
  }
}
