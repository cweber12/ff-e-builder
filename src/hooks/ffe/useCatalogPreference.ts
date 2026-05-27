import { useState, useEffect } from 'react';

export function useCatalogPreference<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      return (sessionStorage.getItem(key) as T) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable — silently ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
