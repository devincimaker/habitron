/**
 * Launch Routing Tests
 *
 * The splash screen routes users via resolveLaunchDecision. The
 * invariant these tests protect: onboarding is only reachable from a
 * successfully loaded profile with no name.
 *
 * Regression (2026-08-21): a failed profile fetch was routed the same
 * as "no profile", sending an existing signed-in user back through
 * onboarding (tour + pick-your-name) after a transient failure.
 */

import { resolveLaunchDecision, type LaunchState } from '../utils/launchRoute';

const base: LaunchState = {
  authInitialized: true,
  hasSession: true,
  profileStatus: 'ready',
  hasName: true,
};

describe('resolveLaunchDecision', () => {
  it('waits while auth is initializing', () => {
    expect(
      resolveLaunchDecision({ ...base, authInitialized: false })
    ).toEqual({ kind: 'wait' });
  });

  it('sends signed-out users to login', () => {
    expect(
      resolveLaunchDecision({ ...base, hasSession: false })
    ).toEqual({ kind: 'navigate', route: '/(auth)/login' });
  });

  it('waits while the profile has not started or finished loading', () => {
    expect(
      resolveLaunchDecision({ ...base, profileStatus: 'idle', hasName: false })
    ).toEqual({ kind: 'wait' });
    expect(
      resolveLaunchDecision({ ...base, profileStatus: 'loading', hasName: false })
    ).toEqual({ kind: 'wait' });
  });

  it('sends a loaded user with a name to the main app', () => {
    expect(resolveLaunchDecision(base)).toEqual({
      kind: 'navigate',
      route: '/(tabs)/tasks',
    });
  });

  it('sends a loaded user without a name to onboarding', () => {
    expect(
      resolveLaunchDecision({ ...base, hasName: false })
    ).toEqual({ kind: 'navigate', route: '/(onboarding)/tour' });
  });

  /**
   * REGRESSION: a failed profile fetch must surface an error, never
   * route to onboarding — even though no name is available.
   */
  it('surfaces an error (not onboarding) when the profile fetch failed', () => {
    const decision = resolveLaunchDecision({
      ...base,
      profileStatus: 'error',
      hasName: false,
    });

    expect(decision).toEqual({ kind: 'error' });
  });

  it('never routes to onboarding unless the profile is ready', () => {
    const statuses = ['idle', 'loading', 'error'] as const;
    for (const profileStatus of statuses) {
      const decision = resolveLaunchDecision({ ...base, profileStatus, hasName: false });
      expect(decision.kind).not.toBe('navigate');
    }
  });
});
