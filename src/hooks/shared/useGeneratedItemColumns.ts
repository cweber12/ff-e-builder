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
};

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

  const visibleColumns = useMemo(
    () =>
      columnConfig.visibleOrder
        .map((columnId) => {
          const defaultColumn = defaultColumnMap.get(columnId);
          if (defaultColumn !== undefined) return defaultColumn;
          const customDef = customDefMap.get(columnId);
          if (!customDef) return null;
          return buildCustomColumn(customDef);
        })
        .filter((column): column is TColumn => column !== null),
    [buildCustomColumn, columnConfig.visibleOrder, customDefMap, defaultColumnMap],
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
    () => columnConfig.visibleOrder.filter((id) => !nonDraggableIdSet.has(id)),
    [columnConfig.visibleOrder, nonDraggableIdSet],
  );

  return {
    columnConfig,
    visibleColumns,
    hiddenDefaults,
    draggableColumnIds,
  };
}

export type { DefaultColumnDescriptor, GeneratedItemColumnsPreset };
