import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSessionStore } from '../stores/useSessionStore';

export function useAppStateHandler() {
  const appState = useRef(AppState.currentState);
  const { isActive, syncMessages } = useSessionStore();

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        // App is going to background - sync messages
        if (
          appState.current === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          if (isActive) {
            syncMessages();
          }
        }

        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isActive, syncMessages]);
}
