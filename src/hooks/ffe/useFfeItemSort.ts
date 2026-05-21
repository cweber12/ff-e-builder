import { useCallback, useEffect, useState } from 'react';

export type FfeItemSortMode = 'manual' | 'idTag';

const EVENT = 'ffe-item-sort-change';

type ChangeDetail = { projectId: string; mode: FfeItemSortMode };

function storageKey(projectId: string): string {
  return `${projectId}:ffe:itemSort`;
}

function readMode(projectId: string): FfeItemSortMode {
  if (typeof window === 'undefined') return 'manual';
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    return raw === 'idTag' ? 'idTag' : 'manual';
  } catch {
    return 'manual';
  }
}

/**
 * Project-scoped FF&E item sort mode. Persists to localStorage and broadcasts
 * a same-tab custom event so the toolbar toggle and the table consume the same
 * source of truth without prop drilling.
 *
 * - 'manual' (default): respects each item's `sortOrder` (drag-and-drop ordering).
 * - 'idTag': alphanumeric sort by `itemIdTag` using a locale collator with the
 *   `numeric` option so labels like A1, A2, A10 sort naturally.
 */
export function useFfeItemSort(projectId: string): {
  sortMode: FfeItemSortMode;
  setSortMode: (mode: FfeItemSortMode) => void;
} {
  const [sortMode, setSortModeState] = useState<FfeItemSortMode>(() => readMode(projectId));

  useEffect(() => {
    setSortModeState(readMode(projectId));
  }, [projectId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ChangeDetail>).detail;
      if (detail?.projectId === projectId) setSortModeState(detail.mode);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [projectId]);

  const setSortMode = useCallback(
    (mode: FfeItemSortMode) => {
      try {
        window.localStorage.setItem(storageKey(projectId), mode);
      } catch {
        // Non-critical; setting still applies in-memory below.
      }
      setSortModeState(mode);
      window.dispatchEvent(new CustomEvent<ChangeDetail>(EVENT, { detail: { projectId, mode } }));
    },
    [projectId],
  );

  return { sortMode, setSortMode };
}
