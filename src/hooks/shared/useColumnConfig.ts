import { useCallback, useEffect, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { CustomColumnDef } from '../../types';

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

const CONFIG_EVENT = 'ffe:column-config-changed';

function dispatchConfigEvent(key: string) {
  window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: { key } }));
}

function insertBeforeAnchor(order: string[], ids: string[], anchorId?: string): string[] {
  if (!anchorId) return [...order, ...ids];
  const anchorIndex = order.indexOf(anchorId);
  if (anchorIndex === -1) return [...order, ...ids];
  return [...order.slice(0, anchorIndex), ...ids, ...order.slice(anchorIndex)];
}

/**
 * Manages column order and visibility for a table, backed by localStorage.
 *
 * `defaultColumnIds` — stable, ordered list of built-in column IDs (e.g. the
 *   `id` fields from `createColumns`). Must be referentially stable (useMemo or
 *   module-level const) to avoid reinitialisation on every render.
 *
 * `customDefs` — live list of user-created `CustomColumnDef` records for this
 *   project, sorted by `sortOrder`. Pass `[]` for tables that don't support
 *   custom columns yet.
 *
 * `insertBeforeId` — when new custom column defs are discovered, insert them
 *   before this default column ID instead of appending to the end.
 */
export function useColumnConfig(
  projectId: string,
  tableKey: string,
  defaultColumnIds: readonly string[],
  customDefs: CustomColumnDef[],
  insertBeforeId?: string,
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
          order: insertBeforeAnchor([...saved.order, ...newDefaults], newCustom, insertBeforeId),
          hidden: saved.hidden,
        };
        writeConfig(projectId, tableKey, merged);
        return merged;
      }
      return saved;
    }
    // First load: order = defaults with custom defs inserted before anchor.
    const initial: ColumnConfig = {
      order: insertBeforeAnchor(
        [...defaultColumnIds],
        customDefs.map((d) => d.id),
        insertBeforeId,
      ),
      hidden: [],
    };
    writeConfig(projectId, tableKey, initial);
    return initial;
  });

  const persist = useCallback(
    (next: ColumnConfig) => {
      setConfig(next);
      writeConfig(projectId, tableKey, next);
      dispatchConfigEvent(storageKey(projectId, tableKey));
    },
    [projectId, tableKey],
  );

  // Keep in sync when another mounted instance (e.g. AppBarActions popover) changes config.
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => {
    const key = storageKey(projectId, tableKey);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key !== key) return;
      const fresh = readConfig(projectId, tableKey);
      if (fresh) setConfig(fresh);
    };
    window.addEventListener(CONFIG_EVENT, handler);
    return () => window.removeEventListener(CONFIG_EVENT, handler);
  }, [projectId, tableKey]);

  // Sync any custom def IDs added after mount (e.g. after createItemColumnDef resolves).
  // Using a stable string key avoids re-running when React Query returns a new array reference.
  const customDefIdsKey = customDefs.map((d) => d.id).join(',');
  useEffect(() => {
    setConfig((current) => {
      const known = new Set(current.order);
      const newIds = customDefIdsKey
        ? customDefIdsKey.split(',').filter((id) => id && !known.has(id))
        : [];
      if (newIds.length === 0) return current;
      const next: ColumnConfig = {
        ...current,
        order: insertBeforeAnchor(current.order, newIds, insertBeforeId),
      };
      writeConfig(projectId, tableKey, next);
      return next;
    });
  }, [customDefIdsKey, insertBeforeId, projectId, tableKey]);

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
