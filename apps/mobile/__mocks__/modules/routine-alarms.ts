/**
 * The real module calls `requireNativeModule` at import time, which has no
 * answer under jest's node environment. Mapped in by jest.config.js, the same
 * way @sentry/react-native is.
 */
export default {
  isAvailable: true,
  requestAuthorization: jest.fn(async () => 'authorized' as const),
  replaceAll: jest.fn(async () => undefined),
};
