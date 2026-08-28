import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// React only allows act() to drive updates when it is told it is in a test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface RenderedHook<T> {
  /** What the hook returned on its most recent render. */
  current: () => T;
  /** Runs `fn` inside `act`, so state it sets is flushed before the next read. */
  act: (fn: () => void) => void;
  /** The same, for state that settles on a promise — a storage read, say. */
  actAsync: (fn: () => Promise<unknown>) => Promise<void>;
  unmount: () => void;
}

/**
 * Renders a hook on its own, with no screen around it. The mobile suite runs in
 * plain node, so this is a bare renderer rather than a testing library.
 */
export function renderHook<T>(hook: () => T): RenderedHook<T> {
  let latest: T;
  let renderer: ReactTestRenderer;

  function Probe() {
    latest = hook();
    return null;
  }

  act(() => {
    renderer = create(createElement(Probe));
  });

  return {
    current: () => latest,
    act: (fn) => act(fn),
    actAsync: async (fn) => {
      await act(async () => {
        await fn();
      });
    },
    unmount: () => act(() => renderer.unmount()),
  };
}
