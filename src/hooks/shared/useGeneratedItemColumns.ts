import { useMemo } from 'react';
import type {
  FFE_GENERATED_ITEM_TABLE_PRESET,
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
} from '../../lib/table/generatedItemTablePresets';
import type { CustomColumnDef } from '../../types';
import { useColumnConfig } from './useColumnConfig';

type DefaultColumnDescriptor<TColumn> = {
  id: string;
  column: TColumn;
};

type GeneratedItemColumnsPreset =
  | typeof FFE_GENERATED_ITEM_TABLE_PRESET
  | typeof PROPOSAL_GENERATED_ITEM_TABLE_PRESET;

type UseGeneratedItemColumnsOptions<TColumn> = {
  projectId: string;
  preset: GeneratedItemColumnsPreset;
  customColumnDefs: CustomColumnDef[];
  defaultColumns: readonly DefaultColumnDescriptor<TColumn>[];
  buildCustomColumn: (def: CustomColumnDef) => TColumn;
  insertBeforeId?: string;
  nonDraggableIds?: readonly string[];
  /**
   * Active column-group id from the "view" switcher. When set to a group id,
   * only that group's columns (plus the preset's anchor columns and any custom
   * columns) are displayed. `undefined` or `'all'` shows every visible column.
   */
  activeGroupId?: string | undefined;
};

/** The implicit "show everything" view — not stored in `preset.columnGroups`. */
export const ALL_COLUMN_GROUP_ID = 'all';

function resolveHideableIds(preset: GeneratedItemColumnsPreset) {
  if ('defaultColumnIds' in preset) return preset.defaultColumnIds;
  return preset.hideableColumnIds;
}

function resolveLabel(preset: GeneratedItemColumnsPreset, columnId: string) {
  if ('defaultColumnLabels' in preset) {
    const labels = preset.defaultColumnLabels as Record<string, string>;
    return labels[columnId] ?? columnId;
  }
  const columnMeta = preset.columnMeta as Record<string, { label?: string }>;
  return columnMeta[columnId]?.label ?? columnId;
}

export function useGeneratedItemColumns<TColumn>({
  projectId,
  preset,
  customColumnDefs,
  defaultColumns,
  buildCustomColumn,
  insertBeforeId,
  nonDraggableIds = [],
  activeGroupId,
}: UseGeneratedItemColumnsOptions<TColumn>) {
  const hideableColumnIds = resolveHideableIds(preset);
  const columnConfig = useColumnConfig(
    projectId,
    preset.tableKey,
    hideableColumnIds,
    customColumnDefs,
    insertBeforeId,
  );

  const defaultColumnMap = useMemo(
    () => new Map(defaultColumns.map((entry) => [entry.id, entry.column])),
    [defaultColumns],
  );

  const customDefMap = useMemo(
    () => new Map(customColumnDefs.map((definition) => [definition.id, definition])),
    [customColumnDefs],
  );

  // Group filter: when a group is active, keep only its columns + the preset's
  // anchor columns + any custom columns. Layers on top of the visible/hidden
  // order from useColumnConfig — it never mutates the stored config.
  const isInActiveGroup = useMemo(() => {
    if (!activeGroupId || activeGroupId === ALL_COLUMN_GROUP_ID) return () => true;
    const group = preset.columnGroups.find((candidate) => candidate.id === activeGroupId);
    if (!group) return () => true;
    const allowed = new Set<string>([...preset.anchorColumnIds, ...group.columnIds]);
    return (columnId: string) => allowed.has(columnId) || customDefMap.has(columnId);
  }, [activeGroupId, preset, customDefMap]);

  const displayedOrder = useMemo(
    () => columnConfig.visibleOrder.filter(isInActiveGroup),
    [columnConfig.visibleOrder, isInActiveGroup],
  );

  const visibleColumns = useMemo(
    () =>
      displayedOrder
        .map((columnId) => {
          const defaultColumn = defaultColumnMap.get(columnId);
          if (defaultColumn !== undefined) return defaultColumn;
          const customDef = customDefMap.get(columnId);
          if (!customDef) return null;
          return buildCustomColumn(customDef);
        })
        .filter((column): column is TColumn => column !== null),
    [buildCustomColumn, displayedOrder, customDefMap, defaultColumnMap],
  );

  const hiddenDefaults = useMemo(
    () =>
      columnConfig.hiddenDefaults.map((id) => ({
        id,
        label: resolveLabel(preset, id),
      })),
    [columnConfig.hiddenDefaults, preset],
  );

  const nonDraggableIdSet = useMemo(() => new Set(nonDraggableIds), [nonDraggableIds]);
  const draggableColumnIds = useMemo(
    () => displayedOrder.filter((id) => !nonDraggableIdSet.has(id)),
    [displayedOrder, nonDraggableIdSet],
  );

  return {
    columnConfig,
    visibleColumns,
    hiddenDefaults,
    draggableColumnIds,
  };
}

export type { DefaultColumnDescriptor, GeneratedItemColumnsPreset };
