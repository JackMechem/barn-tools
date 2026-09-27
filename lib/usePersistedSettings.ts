import { useCallback, useSyncExternalStore } from "react";

type Store<T> = {
  value: T | null;
  listeners: Set<() => void>;
};

const stores = new Map<string, Store<unknown>>();

function getStore<T>(key: string): Store<T> {
  let store = stores.get(key);
  if (!store) {
    store = { value: null, listeners: new Set() };
    stores.set(key, store);
  }
  return store as Store<T>;
}

/** Keep only stored fields whose type matches the default, so bad data can't break the UI. */
function read<T extends object>(key: string, defaults: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    const merged = { ...defaults } as Record<string, unknown>;
    for (const [field, fallback] of Object.entries(defaults)) {
      const stored = parsed[field];
      const sameType = Array.isArray(fallback)
        ? Array.isArray(stored)
        : typeof stored === typeof fallback;
      if (stored !== undefined && sameType) merged[field] = stored;
    }
    return merged as T;
  } catch {
    return defaults;
  }
}

export function snapshotOf<T extends object>(key: string, defaults: T): T {
  const store = getStore<T>(key);
  if (!store.value) store.value = read(key, defaults);
  return store.value;
}

export function writeSettings<T extends object>(key: string, defaults: T, patch: Partial<T>) {
  const store = getStore<T>(key);
  store.value = { ...snapshotOf(key, defaults), ...patch };
  try {
    window.localStorage.setItem(key, JSON.stringify(store.value));
  } catch {
    // storage unavailable
  }
  for (const listener of store.listeners) listener();
}

export function subscribeTo(key: string, listener: () => void) {
  const store = getStore<unknown>(key);
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

/**
 * Settings object persisted to localStorage. `defaults` must be a stable
 * (module-level) object. Renders defaults on the server and first paint,
 * then the saved values.
 */
export function usePersistedSettings<T extends object>(
  key: string,
  defaults: T
): [T, (patch: Partial<T>) => void] {
  const subscribe = useCallback((listener: () => void) => subscribeTo(key, listener), [key]);
  const getSnapshot = useCallback(() => snapshotOf(key, defaults), [key, defaults]);
  const getServerSnapshot = useCallback(() => defaults, [defaults]);

  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback(
    (patch: Partial<T>) => writeSettings(key, defaults, patch),
    [key, defaults]
  );

  return [settings, update];
}
