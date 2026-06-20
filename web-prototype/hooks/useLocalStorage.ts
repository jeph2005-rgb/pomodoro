'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Generic, hydration-safe localStorage hook (FR-10).
 *
 * The initial render (server and first client render) always returns
 * `defaultValue` to avoid a React hydration mismatch. The persisted value is
 * read only after mount, in an effect, and then applied to state.
 *
 * Every localStorage access is wrapped in try/catch: if storage is unavailable
 * (SSR / private mode / disabled / quota) or the stored JSON is missing or
 * malformed, we fall back to `defaultValue` without throwing or logging.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // Read persisted value after mount only. Reading during render (or in a
  // useState initializer) would run on the server where localStorage is absent
  // and cause a hydration mismatch, so the sync-setState-in-effect here is
  // intentional and required for hydration safety.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Unavailable or malformed: keep defaultValue.
    }
  }, [key]);

  const persist = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Unavailable or quota exceeded: state still updates in memory.
      }
    },
    [key]
  );

  return [value, persist];
}
