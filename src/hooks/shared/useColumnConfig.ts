import { useCallback, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { ItemColumnDef } from '../../types';

export type ColumnConfig = {
  /** Ordered list of all visible column IDs (default + custom). */
  order: string[];
  /** IDs of default columns the user has hidden. */
  hidden: string[];
};

function storageKey(projectId: string, tableKey: string) {
  return `${projectId}:${tableKey}:columnConfig`;
}

function readConfig(projectId: string, tableKey: string): ColumnConfig | null {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId, tableKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'order' in parsed &&
      'hidden' in parsed &&
      Array.isArray((parsed as ColumnConfig).order) &&
      Array.isArray((parsed as ColumnConfig).hidden)
    ) {
      return parsed as ColumnConfig;
    }
    return null;
  } catch {
    return null;
  }
}

function writeConfig(projectId: string, tableKey: string, config: ColumnConfig) {
  try {
    window.localStorage.setItem(storageKey(projectId, tableKey), JSON.stringify(config));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

/**
 * Manages column order and visibility for a table, backed by localStorage.
 *
 * `defaultColumnIds` — stable, ordered list of built-in column IDs (e.g. the
 *   `id` fields from `createColumns`). Must be referentially stable (useMemo or
 *   module-level const) to avoid reinitialisation on every render.
 *
 * `customDefs` — live list of user-created `ItemColumnDef` records for this
 *   project, sorted by `sortOrder`. Pass `[]` for tables that don't support
 *   custom columns yet (e.g. ProposalTable in Phase 1).
 */
export function useColumnConfig(
  projectId: string,
  tableKey: string,
  defaultColumnIds: readonly string[],
  customDefs: ItemColumnDef[],
) {
  const [config, setConfig] = useState<ColumnConfig>(() => {
    const saved = readConfig(projectId, tableKey);
    if (saved) {
      // Merge: add any new default columns not yet in the saved order.
      const knownIds = new Set(saved.order);
      const newDefaults = defaultColumnIds.filter(
        (id) => !knownIds.has(id) && !saved.hidden.includes(id),
      );
      const newCustom = customDefs.map((d) => d.id).filter((id) => !knownIds.has(id));
      if (newDefaults.length > 0 || newCustom.length > 0) {
        const merged: ColumnConfig = {
          order: [...saved.order, ...newDefaults, ...newCustom],
          hidden: saved.hidden,
        };
        writeConfig(projectId, tableKey, merged);
        return merged;
      }
      return saved;
    }
    // First load: order = all defaults + custom defs sorted by sortOrder.
    const initial: ColumnConfig = {
      order: [...defaultColumnIds, ...customDefs.map((d) => d.id)],
      hidden: [],
    };
    writeConfig(projectId, tableKey, initial);
    return initial;
  });

  const persist = useCallback(
    (next: ColumnConfig) => {
      setConfig(next);
      writeConfig(projectId, tableKey, next);
    },
    [projectId, tableKey],
  );

  /** Move a column by ID (used on drag-end). */
  const moveColumn = useCallback(
    (fromId: string, toId: string) => {
      setConfig((current) => {
        const fromIndex = current.order.indexOf(fromId);
        const toIndex = current.order.indexOf(toId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
        const next: ColumnConfig = {
          ...current,
          order: arrayMove(current.order, fromIndex, toIndex),
        };
        writeConfig(projectId, tableKey, next);
        return next;
      });
    },
    [projectId, tableKey],
  );

  /** Hide a default column (moves it out of the visible order). */
  const hideDefaultColumn = useCallback(
    (columnId: string) => {
      persist({
        order: config.order.filter((id) => id !== columnId),
        hidden: config.hidden.includes(columnId) ? config.hidden : [...config.hidden, columnId],
      });
    },
    [config, persist],
  );

  /** Restore a previously hidden default column (appends to end). */
  const restoreDefaultColumn = useCallback(
    (columnId: string) => {
      persist({
        order: config.order.includes(columnId) ? config.order : [...config.order, columnId],
        hidden: config.hidden.filter((id) => id !== columnId),
      });
    },
    [config, persist],
  );

  /**
   * Register a newly-created custom column def.
   * Call this after a successful `useCreateItemColumnDef` mutation resolves
   * so the new column appears at the end.
   */
  const addCustomColumn = useCallback(
    (defId: string) => {
      if (config.order.includes(defId)) return;
      persist({
        ...config,
        order: [...config.order, defId],
      });
    },
    [config, persist],
  );

  /** Remove a custom column from the visible order (used on delete). */
  const removeCustomColumn = useCallback(
    (defId: string) => {
      persist({
        ...config,
        order: config.order.filter((id) => id !== defId),
      });
    },
    [config, persist],
  );

  /**
   * Visible column IDs in user-defined order, filtered to only IDs that
   * are either a known default column or a known custom column def.
   * Unknown IDs (stale deleted defs, etc.) are silently dropped.
   */
  const knownIds = new Set([...defaultColumnIds, ...customDefs.map((d) => d.id)]);
  const visibleOrder = config.order.filter((id) => knownIds.has(id));

  /** Default column IDs the user has hidden (for the "restore" list in the column manager). */
  const hiddenDefaults = config.hidden.filter((id) => defaultColumnIds.includes(id));

  return {
    visibleOrder,
    hiddenDefaults,
    moveColumn,
    hideDefaultColumn,
    restoreDefaultColumn,
    addCustomColumn,
    removeCustomColumn,
  };
}
