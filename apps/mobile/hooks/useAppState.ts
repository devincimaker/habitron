import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSessionStore } from '../stores/useSessionStore';
import { useSessionsStore } from '../stores/useSessionsStore';

export function useAppStateHandler() {
  const appState = useRef(AppState.currentState);
  const { isActive, syncMessages, checkAndRecoverSession } = useSessionStore();
  const { loadSessions } = useSessionsStore();

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        // App is coming to foreground
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          if (!isActive) {
            // Check for orphaned sessions when coming to foreground without active session
            const result = await checkAndRecoverSession();
            if (result === 'finalized') {
              // Refresh session list since we finalized an orphaned session
              loadSessions();
            }
          }
        }

        // App is going to background - sync messages
        if (
          appState.current === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          if (isActive) {
            // Sync messages before going to background
            syncMessages();
          }
        }

        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isActive, syncMessages, checkAndRecoverSession, loadSessions]);
}
