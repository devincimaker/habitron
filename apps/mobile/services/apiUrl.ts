import { NativeModules } from 'react-native';

const LOCAL_API_FALLBACK = 'http://localhost:3001';
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1']);
const IS_DEV = typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production';

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(
  configuredApiUrl: string,
  scriptUrl: string | null,
  isDev: boolean
): string {
  const normalizedConfiguredApiUrl = normalizeBaseUrl(configuredApiUrl);
  const configuredUrl = tryParseUrl(normalizedConfiguredApiUrl);

  if (!configuredUrl || !isDev || !LOCAL_API_HOSTS.has(configuredUrl.hostname)) {
    return normalizedConfiguredApiUrl;
  }

  const bundleUrl = scriptUrl ? tryParseUrl(scriptUrl) : null;
  if (!bundleUrl || LOCAL_API_HOSTS.has(bundleUrl.hostname)) {
    return normalizedConfiguredApiUrl;
  }

  configuredUrl.hostname = bundleUrl.hostname;
  return configuredUrl.origin;
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

export function isLocalApiUrl(baseUrl: string): boolean {
  const parsedUrl = tryParseUrl(baseUrl);
  return Boolean(parsedUrl && LOCAL_API_HOSTS.has(parsedUrl.hostname));
}

function getRuntimeScriptUrl(): string | null {
  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  return sourceCode?.scriptURL ?? null;
}

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || LOCAL_API_FALLBACK,
  getRuntimeScriptUrl(),
  IS_DEV
);

export function createApiUrl(path: string): string {
  return buildApiUrl(API_BASE_URL, path);
}

export function getCoachRequestErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    /network request failed/i.test(error.message)
  ) {
    if (IS_DEV && isLocalApiUrl(API_BASE_URL)) {
      return "I couldn't reach the local coach server. Start it with pnpm dev and try again.";
    }

    return "I couldn't reach the coach service just now. Please try again.";
  }

  return 'Sorry, I had trouble processing that. Please try again.';
}
