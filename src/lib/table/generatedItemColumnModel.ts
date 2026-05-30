import type { Item, ProposalItem } from '../../types';
import type {
  FFE_GENERATED_ITEM_TABLE_PRESET,
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
} from './generatedItemTablePresets';

type GeneratedItemColumnsPreset =
  | typeof FFE_GENERATED_ITEM_TABLE_PRESET
  | typeof PROPOSAL_GENERATED_ITEM_TABLE_PRESET;

type FfeGeneratedItemColumnsPreset = typeof FFE_GENERATED_ITEM_TABLE_PRESET;

type StickyKind = 'edge' | 'value' | null;

export type ResolvedColumnCellKind =
  | 'drag'
  | 'text'
  | 'image'
  | 'plan-image'
  | 'materials'
  | 'quantity'
  | 'money'
  | 'computed-money'
  | 'status'
  | 'actions'
  | 'custom';

export type ResolvedColumn = {
  id: string;
  label: string;
  group: string | null;
  sticky: StickyKind;
  omitWhenEmpty: boolean;
  cellKind: ResolvedColumnCellKind;
  actions: readonly string[];
  icons: readonly string[];
};

export type GeneratedItemColumnViewState = {
  customColumns?: readonly {
    id: string;
    label?: string | undefined;
  }[];
};

const FFE_OMIT_WHEN_EMPTY_IDS = new Set([
  'itemIdTag',
  'drawings',
  'description',
  'dimensions',
  'materials',
  'category',
  'leadTime',
  'notes',
]);

const PROPOSAL_OMIT_WHEN_EMPTY_IDS = new Set([
  'itemName',
  'plan',
  'drawings',
  'location',
  'description',
  'notes',
  'size',
  'swatch',
  'cbm',
]);

function resolveColumnIds(preset: GeneratedItemColumnsPreset): string[] {
  if (isFfePreset(preset)) return [...preset.defaultColumnIds];
  return [...preset.hideableColumnIds, ...preset.fixedColumnIds, 'total', 'actions'];
}

function resolveLabel(preset: GeneratedItemColumnsPreset, id: string): string {
  if (isFfePreset(preset)) {
    const labels = preset.defaultColumnLabels as Record<string, string | undefined>;
    return labels[id] ?? id;
  }

  if (id === 'quantity') return 'Quantity';
  if (id === 'unitCost') return 'Unit Cost';
  if (id === 'total') return 'Total';
  if (id === 'actions') return 'Actions';
  const columnMeta = preset.columnMeta as Record<string, { label: string } | undefined>;
  return columnMeta[id]?.label ?? id;
}

function isFfePreset(preset: GeneratedItemColumnsPreset): preset is FfeGeneratedItemColumnsPreset {
  return preset.view === 'ffe';
}

function resolveGroupMap(preset: GeneratedItemColumnsPreset): Map<string, string> {
  const groupMap = new Map<string, string>();
  for (const group of preset.columnGroups) {
    for (const columnId of group.columnIds) {
      groupMap.set(columnId, group.id);
    }
  }
  return groupMap;
}

function resolveSticky(tableKey: GeneratedItemColumnsPreset['tableKey'], id: string): StickyKind {
  if (id === 'actions') return 'edge';
  if (tableKey === 'ffe') return id === 'lineTotal' ? 'edge' : null;
  if (id === 'total') return 'edge';
  if (id === 'quantity' || id === 'unitCost') return 'value';
  return null;
}

function resolveOmitWhenEmpty(
  tableKey: GeneratedItemColumnsPreset['tableKey'],
  id: string,
): boolean {
  if (tableKey === 'ffe') return FFE_OMIT_WHEN_EMPTY_IDS.has(id);
  return PROPOSAL_OMIT_WHEN_EMPTY_IDS.has(id);
}

function resolveCellKind(id: string): ResolvedColumnCellKind {
  if (id === 'drag') return 'drag';
  if (id === 'image' || id === 'rendering') return 'image';
  if (id === 'plan') return 'plan-image';
  if (id === 'materials' || id === 'swatch') return 'materials';
  if (id === 'qty' || id === 'quantity') return 'quantity';
  if (id === 'unitCostCents' || id === 'unitCost') return 'money';
  if (id === 'lineTotal' || id === 'total') return 'computed-money';
  if (id === 'status') return 'status';
  if (id === 'actions') return 'actions';
  return 'text';
}

export function resolveGeneratedItemColumns(
  preset: GeneratedItemColumnsPreset,
  _items: readonly (Item | ProposalItem)[],
  viewState: GeneratedItemColumnViewState = {},
): ResolvedColumn[] {
  const groupMap = resolveGroupMap(preset);
  const resolved = resolveColumnIds(preset).map((id) => ({
    id,
    label: resolveLabel(preset, id),
    group: groupMap.get(id) ?? null,
    sticky: resolveSticky(preset.tableKey, id),
    omitWhenEmpty: resolveOmitWhenEmpty(preset.tableKey, id),
    cellKind: resolveCellKind(id),
    actions: [],
    icons: [],
  }));

  const custom = (viewState.customColumns ?? []).map<ResolvedColumn>((column) => ({
    id: column.id,
    label: column.label ?? column.id,
    group: null,
    sticky: null,
    omitWhenEmpty: true,
    cellKind: 'custom',
    actions: [],
    icons: [],
  }));

  return [...resolved, ...custom];
}
