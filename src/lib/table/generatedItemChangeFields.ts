export type GeneratedItemChangeFieldMeta = {
  columnKey: string;
  columnLabel: string;
  isPriceAffecting: boolean;
};

export const GENERATED_ITEM_CHANGE_FIELDS = {
  ffe: {
    itemName: {
      columnKey: 'description',
      columnLabel: 'Item',
      isPriceAffecting: false,
    },
    itemIdTag: {
      columnKey: 'product_tag',
      columnLabel: 'ID',
      isPriceAffecting: false,
    },
    notes: {
      columnKey: 'notes',
      columnLabel: 'Notes',
      isPriceAffecting: false,
    },
    dimensions: {
      columnKey: 'size_label',
      columnLabel: 'Dimensions',
      isPriceAffecting: true,
    },
    qty: {
      columnKey: 'quantity',
      columnLabel: 'Qty',
      isPriceAffecting: true,
    },
    unitCostCents: {
      columnKey: 'unit_cost_cents',
      columnLabel: 'Unit Cost',
      isPriceAffecting: true,
    },
  },
  proposal: {
    size: {
      columnKey: 'size',
      columnLabel: 'Size',
      isPriceAffecting: true,
    },
    quantity: {
      columnKey: 'quantity',
      columnLabel: 'Quantity',
      isPriceAffecting: true,
    },
    cbm: {
      columnKey: 'cbm',
      columnLabel: 'CBM',
      isPriceAffecting: true,
    },
    unitCostCents: {
      columnKey: 'unitCostCents',
      columnLabel: 'Unit Cost',
      isPriceAffecting: false,
    },
    productTag: {
      columnKey: 'productTag',
      columnLabel: 'Product Tag',
      isPriceAffecting: false,
    },
    plan: {
      columnKey: 'plan',
      columnLabel: 'Plan',
      isPriceAffecting: false,
    },
    drawings: {
      columnKey: 'drawings',
      columnLabel: 'Drawings',
      isPriceAffecting: false,
    },
    location: {
      columnKey: 'location',
      columnLabel: 'Location',
      isPriceAffecting: false,
    },
    description: {
      columnKey: 'description',
      columnLabel: 'Description',
      isPriceAffecting: false,
    },
    notes: {
      columnKey: 'notes',
      columnLabel: 'Notes',
      isPriceAffecting: false,
    },
    quantityUnit: {
      columnKey: 'quantityUnit',
      columnLabel: 'Quantity Unit',
      isPriceAffecting: false,
    },
    customData: {
      columnKey: 'customData',
      columnLabel: 'Custom Field',
      isPriceAffecting: false,
    },
  },
} as const satisfies {
  ffe: Record<string, GeneratedItemChangeFieldMeta>;
  proposal: Record<string, GeneratedItemChangeFieldMeta>;
};
