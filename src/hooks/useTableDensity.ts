import { useCallback, useEffect, useRef, useState } from 'react';

export type TableDensity = 'compact' | 'default' | 'tall';

const STORAGE_KEY = 'table-density';
const DENSITY_EVENT = 'ffe:density-changed';

function readDensity(): TableDensity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'compact' || raw === 'default' || raw === 'tall') return raw;
  } catch {
    // SSR / private browsing
  }
  return 'default';
}

export function useTableDensity() {
  const [density, setDensityState] = useState<TableDensity>(readDensity);

  const setDensity = useCallback((next: TableDensity) => {
    setDensityState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(DENSITY_EVENT));
    } catch {
      // ignore
    }
  }, []);

  // Keep in sync when another mounted instance changes density.
  const densityRef = useRef(density);
  densityRef.current = density;
  useEffect(() => {
    const handler = () => {
      const fresh = readDensity();
      if (fresh !== densityRef.current) setDensityState(fresh);
    };
    window.addEventListener(DENSITY_EVENT, handler);
    return () => window.removeEventListener(DENSITY_EVENT, handler);
  }, []);

  return { density, setDensity };
}

/** Maps density level to Tailwind height class for data rows. */
export function densityRowClass(density: TableDensity): string {
  switch (density) {
    case 'compact':
      return 'h-10';
    case 'tall':
      return 'h-16';
    default:
      return 'h-13';
  }
}

/** Maps density level to thumbnail size class. */
export function densityThumbClass(density: TableDensity): string {
  switch (density) {
    case 'compact':
      return 'h-8 w-8';
    case 'tall':
      return 'h-12 w-12';
    default:
      return 'h-10 w-10';
  }
}

/** Prevents stale closure warnings; returns the latest ref value. */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}
