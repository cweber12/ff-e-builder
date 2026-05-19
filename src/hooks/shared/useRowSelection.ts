import { useCallback, useRef, useState } from 'react';

export type TableId = 'ffe' | 'proposal';

export interface UseRowSelectionReturn {
  selectedIds: string[];
  toggle: (id: string) => void;
  toggleRange: (id: string, allIds: string[]) => void;
  selectAllVisible: (allIds: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  isAllSelected: (allIds: string[]) => boolean;
  isSomeSelected: (allIds: string[]) => boolean;
}

export function useRowSelection(_tableId?: TableId): UseRowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastToggledRef = useRef<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      lastToggledRef.current = id;
      return next;
    });
  }, []);

  const toggleRange = useCallback(
    (id: string, allIds: string[]) => {
      const anchor = lastToggledRef.current;
      if (!anchor || anchor === id) {
        toggle(id);
        return;
      }
      const anchorIdx = allIds.indexOf(anchor);
      const targetIdx = allIds.indexOf(id);
      if (anchorIdx === -1 || targetIdx === -1) {
        toggle(id);
        return;
      }
      const [start, end] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
      const rangeIds = allIds.slice(start, end + 1);
      setSelectedIds((prev) => {
        const adding = !prev.includes(id);
        if (adding) {
          const combined = [...new Set([...prev, ...rangeIds])];
          return combined;
        } else {
          return prev.filter((x) => !rangeIds.includes(x));
        }
      });
      lastToggledRef.current = id;
    },
    [toggle],
  );

  const selectAllVisible = useCallback((allIds: string[]) => {
    setSelectedIds((prev) => {
      // If all are already selected, deselect all
      if (allIds.every((id) => prev.includes(id))) return [];
      return [...new Set([...prev, ...allIds])];
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds([]);
    lastToggledRef.current = null;
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const isAllSelected = useCallback(
    (allIds: string[]) => allIds.length > 0 && allIds.every((id) => selectedIds.includes(id)),
    [selectedIds],
  );

  const isSomeSelected = useCallback(
    (allIds: string[]) =>
      allIds.some((id) => selectedIds.includes(id)) &&
      !allIds.every((id) => selectedIds.includes(id)),
    [selectedIds],
  );

  return {
    selectedIds,
    toggle,
    toggleRange,
    selectAllVisible,
    clear,
    isSelected,
    isAllSelected,
    isSomeSelected,
  };
}
