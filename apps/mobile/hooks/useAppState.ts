import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSessionStore } from '../stores/useSessionStore';

export function useAppStateHandler() {
  const appState = useRef(AppState.currentState);
  const { isActive, updateLastActive, checkSessionTimeout } = useSessionStore();

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        // App is coming to foreground
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          if (isActive) {
            // Check if session has timed out while in background
            const timedOut = checkSessionTimeout();
            if (!timedOut) {
              // Session still valid, update last active time
              updateLastActive();
            }
          }
        }

        // App is going to background - update lastActiveAt
        if (
          appState.current === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          if (isActive) {
            updateLastActive();
          }
        }

        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isActive, updateLastActive, checkSessionTimeout]);
}
