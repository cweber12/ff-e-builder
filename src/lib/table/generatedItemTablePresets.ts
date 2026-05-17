export type GeneratedItemTableView = 'ffe' | 'proposal';

export type GeneratedItemTablePreset = {
  view: GeneratedItemTableView;
  tableKey: GeneratedItemTableView;
  groupKind: 'room' | 'proposal-category';
  groupLabel: string;
  groupPluralLabel: string;
};

export const FFE_GENERATED_ITEM_TABLE_PRESET = {
  view: 'ffe',
  tableKey: 'ffe',
  groupKind: 'room',
  groupLabel: 'Location',
  groupPluralLabel: 'locations',
  defaultColumnIds: [
    'drag',
    'image',
    'plan',
    'itemIdTag',
    'itemName',
    'description',
    'category',
    'dimensions',
    'materials',
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
    image: 'Rendering',
    plan: 'Plan',
    itemIdTag: 'ID',
    itemName: 'Name',
    description: 'Product Description',
    category: 'Category',
    dimensions: 'Dimensions',
    materials: 'Materials',
    qty: 'Quantity',
    unitCostCents: 'Unit Cost',
    lineTotal: 'Total',
    status: 'Status',
    leadTime: 'Lead Time',
    notes: 'Notes',
    actions: 'Actions',
  },
} as const satisfies GeneratedItemTablePreset & {
  defaultColumnIds: readonly string[];
  defaultColumnLabels: Record<string, string>;
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
    'productTag',
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
    productTag: { label: 'ID', className: 'min-w-36' },
    plan: { label: 'Plan', className: 'w-36 min-w-36' },
    drawings: { label: 'Drawings', className: 'min-w-36' },
    location: { label: 'Location', className: 'min-w-36' },
    description: { label: 'Product Description', className: 'min-w-64' },
    notes: { label: 'Notes', className: 'min-w-48' },
    size: { label: 'Size', className: 'w-44 min-w-44' },
    swatch: { label: 'Swatch', className: 'min-w-36' },
    cbm: { label: 'CBM', className: 'w-24 min-w-24' },
  },
} as const satisfies GeneratedItemTablePreset & {
  fixedColumnIds: readonly string[];
  hideableColumnIds: readonly string[];
  columnMeta: Record<string, { label: string; className: string }>;
};
