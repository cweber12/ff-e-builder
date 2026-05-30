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
  'footprint',
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
  if (tableKey === 'ffe') {
    if (id === 'lineTotal') return 'edge';
    if (id === 'qty' || id === 'unitCostCents') return 'value';
    return null;
  }
  if (id === 'total') return 'edge';
  if (id === 'quantity' || id === 'unitCost') return 'value';
  return null;
}

function isBlankString(value: string | null | undefined): boolean {
  return !value || value.trim() === '';
}

function customColumnIsEmpty(items: readonly (Item | ProposalItem)[], columnId: string): boolean {
  return !items.some((item) => !isBlankString(item.customData[columnId] ?? ''));
}

function resolveFfeOmitWhenEmpty(id: string, items: readonly Item[]): boolean {
  if (items.length === 0) return false;
  if (!FFE_OMIT_WHEN_EMPTY_IDS.has(id)) return false;
  if (id === 'itemIdTag') return !items.some((item) => !isBlankString(item.itemIdTag));
  if (id === 'drawings') return !items.some((item) => !isBlankString(item.drawings));
  if (id === 'description') return !items.some((item) => !isBlankString(item.description));
  if (id === 'dimensions') return !items.some((item) => !isBlankString(item.dimensions));
  if (id === 'materials') return !items.some((item) => item.materials.length > 0);
  if (id === 'category') return !items.some((item) => !isBlankString(item.category));
  if (id === 'leadTime') return !items.some((item) => !isBlankString(item.leadTime));
  if (id === 'notes') return !items.some((item) => !isBlankString(item.notes));
  return false;
}

function resolveProposalOmitWhenEmpty(id: string, items: readonly ProposalItem[]): boolean {
  if (items.length === 0) return false;
  if (!PROPOSAL_OMIT_WHEN_EMPTY_IDS.has(id)) return false;
  if (id === 'itemName') return !items.some((item) => !isBlankString(item.itemName));
  if (id === 'plan') return !items.some((item) => !isBlankString(item.plan));
  if (id === 'drawings') return !items.some((item) => !isBlankString(item.drawings));
  if (id === 'location') return !items.some((item) => !isBlankString(item.location));
  if (id === 'description') return !items.some((item) => !isBlankString(item.description));
  if (id === 'notes') return !items.some((item) => !isBlankString(item.notes));
  if (id === 'size') return !items.some((item) => !isBlankString(item.sizeLabel));
  if (id === 'footprint') return !items.some((item) => !isBlankString(item.footprintLabel));
  if (id === 'swatch') return !items.some((item) => item.materials.length > 0);
  if (id === 'cbm') return !items.some((item) => item.cbm > 0);
  return false;
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
  items: readonly (Item | ProposalItem)[],
  viewState: GeneratedItemColumnViewState = {},
): ResolvedColumn[] {
  const groupMap = resolveGroupMap(preset);
  const customColumnIds = new Set((viewState.customColumns ?? []).map((column) => column.id));
  const resolved = resolveColumnIds(preset).map((id) => {
    const omitWhenEmpty = customColumnIds.has(id)
      ? customColumnIsEmpty(items, id)
      : isFfePreset(preset)
        ? resolveFfeOmitWhenEmpty(id, items as readonly Item[])
        : resolveProposalOmitWhenEmpty(id, items as readonly ProposalItem[]);

    return {
      id,
      label: resolveLabel(preset, id),
      group: groupMap.get(id) ?? null,
      sticky: resolveSticky(preset.tableKey, id),
      omitWhenEmpty,
      cellKind: resolveCellKind(id),
      actions: [],
      icons: [],
    };
  });

  const custom = (viewState.customColumns ?? []).map<ResolvedColumn>((column) => ({
    id: column.id,
    label: column.label ?? column.id,
    group: null,
    sticky: null,
    omitWhenEmpty: customColumnIsEmpty(items, column.id),
    cellKind: 'custom',
    actions: [],
    icons: [],
  }));

  return [...resolved, ...custom];
}
