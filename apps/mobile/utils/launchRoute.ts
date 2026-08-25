import type { ProfileLoadStatus } from '../stores/useProfileStore';

type LaunchRoute = '/(auth)/login' | '/(onboarding)/tour' | '/(tabs)/tasks';

export type LaunchDecision =
  | { kind: 'wait' }
  | { kind: 'error' }
  | { kind: 'navigate'; route: LaunchRoute };

export interface LaunchState {
  authInitialized: boolean;
  hasSession: boolean;
  profileStatus: ProfileLoadStatus;
  hasName: boolean;
}

/**
 * Decides where the splash screen sends the user.
 *
 * Onboarding is only ever chosen from a successfully loaded profile
 * ('ready') with no name. A failed profile fetch ('error') must never
 * fall through to onboarding: that would make an existing user re-do
 * onboarding after a transient network/auth failure.
 */
export function resolveLaunchDecision(state: LaunchState): LaunchDecision {
  if (!state.authInitialized) {
    return { kind: 'wait' };
  }

  if (!state.hasSession) {
    return { kind: 'navigate', route: '/(auth)/login' };
  }

  switch (state.profileStatus) {
    case 'idle':
    case 'loading':
      return { kind: 'wait' };
    case 'error':
      return { kind: 'error' };
    case 'ready':
      return {
        kind: 'navigate',
        route: state.hasName ? '/(tabs)/tasks' : '/(onboarding)/tour',
      };
  }
}
