import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useColumnConfig } from '../../hooks/shared';
import { useTableDensity, type TableDensity } from '../../hooks/useTableDensity';
import { useColumnDefs } from '../../hooks';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Column metadata — parallel to the label maps inside each table component.
// These label maps exist here so AppBarActions can render the popover without
// coupling to FfeTable or ProposalTable internals.
// ---------------------------------------------------------------------------

const FFE_DEFAULT_COLUMN_IDS = [
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
] as const;

/** Columns the user may hide/restore in the FFE table. */
const FFE_HIDEABLE_IDS = new Set<string>([
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
]);

const FFE_COLUMN_LABELS: Record<string, string> = {
  image: 'Rendering',
  plan: 'Plan',
  itemIdTag: 'ID',
  itemName: 'Item',
  description: 'Product Description',
  category: 'Category',
  dimensions: 'Dimensions',
  materials: 'Materials',
  qty: 'Qty',
  unitCostCents: 'Unit Cost',
  lineTotal: 'Total',
  status: 'Status',
  leadTime: 'Lead Time',
  notes: 'Notes',
};

const PROPOSAL_DEFAULT_COLUMN_IDS = [
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
  'quantity',
  'unitCost',
] as const;

/** All proposal columns are user-hideable. */
const PROPOSAL_HIDEABLE_IDS = new Set<string>([...PROPOSAL_DEFAULT_COLUMN_IDS]);

const PROPOSAL_COLUMN_LABELS: Record<string, string> = {
  rendering: 'Rendering',
  productTag: 'Product Tag',
  plan: 'Plan',
  drawings: 'Drawings',
  location: 'Location',
  description: 'Product Description',
  notes: 'Notes',
  size: 'Size',
  swatch: 'Swatch',
  cbm: 'CBM',
  quantity: 'Quantity',
  unitCost: 'Unit Cost',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig(tableKey: 'ffe' | 'proposal') {
  if (tableKey === 'proposal') {
    return {
      defaultIds: PROPOSAL_DEFAULT_COLUMN_IDS as readonly string[],
      hideableIds: PROPOSAL_HIDEABLE_IDS,
      labels: PROPOSAL_COLUMN_LABELS,
    };
  }
  return {
    defaultIds: FFE_DEFAULT_COLUMN_IDS as readonly string[],
    hideableIds: FFE_HIDEABLE_IDS,
    labels: FFE_COLUMN_LABELS,
  };
}

const DENSITY_OPTIONS: { value: TableDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'tall', label: 'Tall' },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ColumnsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="2" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="6.5" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M2 2l12 12M6.5 6.59A3 3 0 009.41 9.5M3.6 4.4A7.5 7.5 0 001 8s2.7 5 7 5a6.8 6.8 0 003.4-.93M6 3.14A6.7 6.7 0 018 3c4.3 0 7 5 7 5a8 8 0 01-2.1 2.54"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ColumnVisibilityPopover
// ---------------------------------------------------------------------------

interface ColumnVisibilityPopoverProps {
  projectId: string;
  tableKey: 'ffe' | 'proposal';
}

export function ColumnVisibilityPopover({ projectId, tableKey }: ColumnVisibilityPopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { density, setDensity } = useTableDensity();
  const { data: customDefs = [] } = useColumnDefs(projectId, tableKey);

  const { defaultIds, hideableIds, labels } = getConfig(tableKey);
  const columnConfig = useColumnConfig(projectId, tableKey, defaultIds, customDefs);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  // Visible hideable columns in user order.
  const visibleHideable = columnConfig.visibleOrder.filter((id) => hideableIds.has(id));

  // Hidden default columns.
  const hiddenDefaults = columnConfig.hiddenDefaults.filter((id) => hideableIds.has(id));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title="Column visibility & density"
        aria-label="Column visibility & density"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors',
          open && 'bg-neutral-100 text-neutral-900',
        )}
      >
        <ColumnsIcon />
      </button>

      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 6,
              right: window.innerWidth - triggerRect.right,
            }}
            className="z-[200] w-64 rounded-lg border border-neutral-200 bg-white shadow-lg"
          >
            {/* Density section */}
            <div className="border-b border-neutral-100 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                Row density
              </p>
              <div className="flex gap-1">
                {DENSITY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDensity(value)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      density === value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Column visibility section */}
            <div className="px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                Columns
              </p>
              <div className="max-h-72 overflow-y-auto">
                {visibleHideable.map((id) => (
                  <div
                    key={id}
                    className="group flex items-center justify-between rounded px-1 py-1 hover:bg-neutral-50"
                  >
                    <span className="truncate text-sm text-neutral-700">{labels[id] ?? id}</span>
                    <button
                      type="button"
                      title={`Hide ${labels[id] ?? id}`}
                      onClick={() => columnConfig.hideDefaultColumn(id)}
                      className="ml-2 shrink-0 rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100"
                    >
                      <EyeOffIcon />
                    </button>
                  </div>
                ))}

                {hiddenDefaults.length > 0 && (
                  <>
                    {visibleHideable.length > 0 && <div className="my-1 h-px bg-neutral-100" />}
                    {hiddenDefaults.map((id) => (
                      <div
                        key={id}
                        className="flex items-center justify-between rounded px-1 py-1 hover:bg-neutral-50"
                      >
                        <span className="truncate text-sm text-neutral-400 line-through">
                          {labels[id] ?? id}
                        </span>
                        <button
                          type="button"
                          title={`Restore ${labels[id] ?? id}`}
                          onClick={() => columnConfig.restoreDefaultColumn(id)}
                          className="ml-2 shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {visibleHideable.length === 0 && hiddenDefaults.length === 0 && (
                  <p className="py-2 text-center text-xs text-neutral-400">
                    No configurable columns
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
