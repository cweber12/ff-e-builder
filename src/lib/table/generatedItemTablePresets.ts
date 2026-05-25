export type GeneratedItemTableView = 'ffe' | 'proposal';

export type GeneratedItemTablePreset = {
  view: GeneratedItemTableView;
  tableKey: GeneratedItemTableView;
  groupKind: 'room' | 'proposal-category';
  groupLabel: string;
  groupPluralLabel: string;
};

type GeneratedItemColumnMeta = {
  label?: string;
  className: string;
  wraps?: boolean;
};

export const FFE_GENERATED_ITEM_TABLE_PRESET = {
  view: 'ffe',
  tableKey: 'ffe',
  groupKind: 'room',
  groupLabel: 'Location',
  groupPluralLabel: 'locations',
  defaultColumnIds: [
    'drag',
    'itemIdTag',
    'drawings',
    'image',
    'plan',
    'description',
    'dimensions',
    'materials',
    'itemName',
    'qty',
    'unitCostCents',
    'lineTotal',
    'status',
    'leadTime',
    'notes',
    'actions',
  ],
  defaultColumnLabels: {
    drag: 'Drag',
    itemIdTag: 'ID',
    drawings: 'Drawings',
    image: 'Rendering',
    plan: 'Plan',
    itemName: 'Name',
    description: 'Product Description',
    category: 'Category',
    dimensions: 'Size',
    materials: 'Swatch',
    qty: 'Quantity',
    unitCostCents: 'Unit Cost',
    lineTotal: 'Total',
    status: 'Status',
    leadTime: 'Lead Time',
    notes: 'Notes',
    actions: 'Actions',
  },
  defaultColumnMeta: {
    itemIdTag: { className: 'min-w-36' },
    drawings: { className: 'min-w-36' },
    image: { className: 'w-40 min-w-40 max-w-40' },
    plan: { className: 'w-36 min-w-36 max-w-36' },
    itemName: { className: 'w-48 min-w-48 max-w-48', wraps: true },
    description: { className: 'w-64 min-w-64 max-w-64', wraps: true },
  },
} as const satisfies GeneratedItemTablePreset & {
  defaultColumnIds: readonly string[];
  defaultColumnLabels: Record<string, string>;
  defaultColumnMeta: Record<string, Omit<GeneratedItemColumnMeta, 'label'>>;
};

export const PROPOSAL_GENERATED_ITEM_TABLE_PRESET = {
  view: 'proposal',
  tableKey: 'proposal',
  groupKind: 'proposal-category',
  groupLabel: 'Category',
  groupPluralLabel: 'categories',
  fixedColumnIds: ['quantity', 'unitCost'],
  hideableColumnIds: [
    'rendering',
    'itemName',
    'plan',
    'drawings',
    'location',
    'description',
    'notes',
    'size',
    'swatch',
    'cbm',
  ],
  columnMeta: {
    rendering: { label: 'Rendering', className: 'w-40 min-w-40' },
    itemName: { label: 'Name', className: 'min-w-48', wraps: true },
    plan: { label: 'Plan', className: 'w-36 min-w-36' },
    drawings: { label: 'Drawings', className: 'min-w-36' },
    location: { label: 'Location', className: 'min-w-36' },
    description: { label: 'Product Description', className: 'min-w-64', wraps: true },
    notes: { label: 'Notes', className: 'min-w-48' },
    size: { label: 'Size', className: 'w-44 min-w-44' },
    swatch: { label: 'Swatch', className: 'min-w-36' },
    cbm: { label: 'CBM', className: 'w-24 min-w-24' },
  },
} as const satisfies GeneratedItemTablePreset & {
  fixedColumnIds: readonly string[];
  hideableColumnIds: readonly string[];
  columnMeta: Record<string, GeneratedItemColumnMeta & { label: string }>;
};
