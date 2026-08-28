import { usePersistedFlag } from '../hooks/usePersistedFlag';
import { renderHook } from './helpers/renderHook';

const store = new Map<string, string>();
const getItem = jest.fn((key: string) => Promise.resolve(store.get(key) ?? null));
const setItem = jest.fn((key: string, value: string) => {
  store.set(key, value);
  return Promise.resolve();
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => getItem(key),
    setItem: (key: string, value: string) => setItem(key, value),
  },
}));

/** Lets the storage promise and its `.finally` settle before the next read. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('usePersistedFlag', () => {
  beforeEach(() => {
    store.clear();
    getItem.mockClear();
    setItem.mockClear();
  });

  it('is not ready until storage has answered', async () => {
    const hook = renderHook(() => usePersistedFlag('flag'));
    expect(hook.current().isReady).toBe(false);

    await hook.actAsync(settle);
    expect(hook.current().isReady).toBe(true);
    expect(hook.current().value).toBe(false);
  });

  it('comes back with what was stored', async () => {
    store.set('flag', '1');
    const hook = renderHook(() => usePersistedFlag('flag'));

    await hook.actAsync(settle);
    expect(hook.current().value).toBe(true);
  });

  it('writes the value once it changes, and not before', async () => {
    const hook = renderHook(() => usePersistedFlag('flag'));
    await hook.actAsync(settle);
    expect(setItem).not.toHaveBeenCalled();

    await hook.actAsync(async () => {
      hook.current().toggle();
      return settle();
    });

    expect(hook.current().value).toBe(true);
    expect(setItem).toHaveBeenCalledWith('flag', '1');
  });
});
