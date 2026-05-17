import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { cn, emptyToNull } from '../../../lib/utils';
import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../../../lib/money';
import { getSortOrderPatches } from '../../../lib/items';
import {
  ffePatchToGeneratedItemChangeInfo,
  type GeneratedItemChangeInfo,
} from '../../../lib/table/generatedItemChangeInfo';
import { FFE_GENERATED_ITEM_TABLE_PRESET } from '../../../lib/table/generatedItemTablePresets';
import {
  useItemMaterialActions,
  useCreateItem,
  useDeleteItem,
  useCreateRoom,
  useDeleteRoom,
  useMaterials,
  useMoveItem,
  useUpdateItem,
  useUpdateRoom,
  useItemColumnDefs,
  useCreateItemColumnDef,
  useDeleteItemColumnDef,
  useUpdateItemColumnDef,
  useColumnConfig,
  useIsMobileViewport,
  useProposalRevisions,
  useTableDensity,
  densityRowClass,
  type TableDensity,
} from '../../../hooks';
import {
  cents,
  dollarsToCents,
  editableItemPatchSchema,
  formatMoney,
  itemStatuses,
  parseQtyInput,
  parseUnitCostDollarsInput,
  unitCostDollarsToCents,
  type Item,
  type ItemStatus,
  type Project,
  type ProposalItemChangelogEntry,
  type ProposalRevision,
  type RoomWithItems,
} from '../../../types';
import type { CreateMaterialInput, UpdateItemInput } from '../../../lib/api';
import { exportTableCsv, exportTableExcel, exportTablePdf } from '../../../lib/export';
import { ItemStatusChip } from '../../shared/ItemStatusChip';
import { TotalsBar } from '../../shared/TotalsBar';
import { Button } from '../../primitives/Button';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { InlineNumberEdit } from '../../primitives/InlineNumberEdit';
import { Modal } from '../../primitives/Modal';
import { AddItemDrawer, type AddItemMaterialSelection } from './AddItemDrawer';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { MaterialBadges, MaterialLibraryModal } from '../../materials';
import { DimensionEditorModal } from '../../shared/modals/DimensionEditorModal';
import { GroupedTableHeader, GroupedTableSection } from '../../shared/table/TableViewWrappers';
import { AddGroupModal } from '../../shared/modals/AddGroupModal';
import { FfeItemDetailPanel } from './FfeItemDetailPanel';
import { AddColumnModal } from '../../shared/modals/AddColumnModal';
import { CustomColumnHeader } from '../../shared/table/CustomColumnHeader';
import { SortableColHeader } from '../../shared/table/SortableColHeader';
import { ChangeConfirmModal, type ChangeConfirmResult } from '../../proposal/ChangeConfirmModal';
import { RevisionHistoryDot } from '../../proposal/revision';

const DEFAULT_COLUMN_IDS = FFE_GENERATED_ITEM_TABLE_PRESET.defaultColumnIds;

type DefaultColumnId = (typeof DEFAULT_COLUMN_IDS)[number];

const stickyTotalHeaderClassName = 'sticky right-10 z-40 bg-surface w-[120px] min-w-[120px]';
const stickyActionsHeaderClassName = 'sticky right-0 z-40 bg-surface w-10 min-w-10';
const stickyTotalExpandedHeaderClassName =
  'sticky top-0 right-10 z-50 bg-surface w-[120px] min-w-[120px]';
const stickyActionsExpandedHeaderClassName = 'sticky top-0 right-0 z-[60] bg-surface w-10 min-w-10';
const stickyTotalCellClassName =
  'sticky right-10 z-20 bg-surface w-[120px] min-w-[120px] group-hover:bg-neutral-50/60';
const stickyActionsCellClassName =
  'sticky right-0 z-20 bg-surface w-10 min-w-10 group-hover:bg-neutral-50/60';

const DEFAULT_COLUMN_LABELS = FFE_GENERATED_ITEM_TABLE_PRESET.defaultColumnLabels;

type FfeTableProps = {
  roomsWithItems: RoomWithItems[];
  projectId: string;
  project?: Project;
  isLoading?: boolean | undefined;
  error?: Error | null;
  onReload?: (() => void) | undefined;
  onImport?: (() => void) | undefined;
  className?: string | undefined;
  /** Controlled-mode: if provided, external caller manages Add Location modal open state. */
  addRoomOpen?: boolean;
  onAddRoomOpenChange?: (open: boolean) => void;
};

interface ErrorBoundaryProps {
  children: ReactNode;
  queryClient: QueryClient;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ItemsRenderErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  handleReload = () => {
    this.setState({ error: null });
    void this.props.queryClient.invalidateQueries();
  };

  override render() {
    if (this.state.error) {
      return <ItemsErrorState onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

type EditableItemPatch = Omit<UpdateItemInput, 'version'>;

type SaveItemPatch = (item: Item, patch: EditableItemPatch) => Promise<void>;

type FfeRevisionIndicator = {
  revisions: ProposalRevision[];
  changelogByGeneratedItemId: Map<string, ProposalItemChangelogEntry[]>;
};

type FfeRevisionColumnKey =
  | 'itemIdTag'
  | 'itemName'
  | 'dimensions'
  | 'qty'
  | 'unitCostCents'
  | 'notes';

type TableActions = {
  rooms: RoomWithItems[];
  onDuplicate: (item: Item) => Promise<void>;
  onMove: (item: Item, toRoomId: string) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
  onEditMaterials: (item: Item) => void;
};

const saveValidatedPatch = (onSave: SaveItemPatch, item: Item, patch: EditableItemPatch) =>
  onSave(item, editableItemPatchSchema.parse(patch) as EditableItemPatch);

const ffeRevisionColumnKeys: Record<FfeRevisionColumnKey, string[]> = {
  itemIdTag: ['product_tag', 'productTag'],
  itemName: ['description'],
  dimensions: ['size_label', 'size'],
  qty: ['quantity'],
  unitCostCents: ['unit_cost_cents', 'unitCostCents'],
  notes: ['notes'],
};

function revisionEntriesForFfeCell(
  revisionIndicator: FfeRevisionIndicator | undefined,
  itemId: string,
  column: FfeRevisionColumnKey,
) {
  if (!revisionIndicator) return [];
  const entries = revisionIndicator.changelogByGeneratedItemId.get(itemId) ?? [];
  const columnKeys = new Set(ffeRevisionColumnKeys[column]);
  return entries.filter((entry) => columnKeys.has(entry.columnKey));
}

async function assignMaterialsToItem(
  itemId: string,
  materials: AddItemMaterialSelection[],
  assignMaterial: (input: { itemId: string; materialId: string }) => Promise<unknown>,
  createAndAssignMaterial: (input: {
    itemId: string;
    input: CreateMaterialInput;
  }) => Promise<unknown>,
) {
  for (const material of materials) {
    if (material.type === 'existing') {
      await assignMaterial({ itemId, materialId: material.materialId });
    } else {
      await createAndAssignMaterial({ itemId, input: material.input });
    }
  }
}

const formatDollars = (value: number) => formatMoney(dollarsToCents(value));

const nextStatus = (status: ItemStatus): ItemStatus => {
  const index = itemStatuses.indexOf(status);
  return itemStatuses[(index + 1) % itemStatuses.length] ?? 'pending';
};

function RevisionIndicatorWrap({
  children,
  entries,
  revisions,
}: {
  children: ReactNode;
  entries: ProposalItemChangelogEntry[];
  revisions: ProposalRevision[];
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <RevisionHistoryDot
        entries={entries}
        revisions={revisions}
        title="Proposal revision history"
        triggerTitle="View Proposal revision history"
        requireGeneratedItemId
        footer={
          <span className="text-[11px] text-gray-500">Cost resolution is handled in Proposal.</span>
        }
      />
    </span>
  );
}

function EditableTextCell({
  item,
  value,
  field,
  label,
  onSave,
  required = false,
  displayClassName,
  revisionEntries = [],
  revisions = [],
}: {
  item: Item;
  value: string | null;
  field: keyof EditableItemPatch;
  label: string;
  onSave: SaveItemPatch;
  required?: boolean | undefined;
  displayClassName?: string | undefined;
  revisionEntries?: ProposalItemChangelogEntry[] | undefined;
  revisions?: ProposalRevision[] | undefined;
}) {
  const current = value ?? '';

  return (
    <RevisionIndicatorWrap entries={revisionEntries} revisions={revisions}>
      <InlineTextEdit
        value={current}
        aria-label={`${label} for ${item.itemName}`}
        {...(displayClassName ? { className: displayClassName } : {})}
        onSave={(nextValue) => {
          const patchValue = required ? nextValue.trim() : emptyToNull(nextValue);
          return saveValidatedPatch(onSave, item, { [field]: patchValue });
        }}
        renderDisplay={(displayValue) =>
          displayValue.trim().length > 0 ? (
            <span className={displayClassName}>{displayValue}</span>
          ) : (
            <span className="text-gray-400">-</span>
          )
        }
      />
    </RevisionIndicatorWrap>
  );
}

function EditableStatusCell({ item, onSave }: { item: Item; onSave: SaveItemPatch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const saveStatus = (status: ItemStatus) =>
    saveValidatedPatch(onSave, item, {
      status,
    });

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const menuRect = triggerRef.current?.getBoundingClientRect();

  return (
    <span
      className="relative inline-flex items-center gap-1.5"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <button
        type="button"
        aria-label={`Status: ${item.status.charAt(0).toUpperCase()}${item.status.slice(1)} — click to advance`}
        onClick={() => void saveStatus(nextStatus(item.status))}
        className="rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <ItemStatusChip status={item.status} />
      </button>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Choose status for ${item.itemName}`}
        aria-expanded={menuOpen}
        title={`Choose status for ${item.itemName}`}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className="rounded px-1 text-gray-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreIcon />
      </button>
      {menuOpen &&
        menuRect &&
        createPortal(
          <div
            role="menu"
            style={{
              position: 'fixed',
              top: menuRect.bottom + 4,
              left: menuRect.left,
            }}
            className="z-[100] min-w-36 rounded-md border border-gray-200 bg-white p-1 shadow-md"
          >
            {itemStatuses.map((status) => (
              <button
                key={status}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void saveStatus(status);
                }}
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <ItemStatusChip status={status} />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}

function EditableDimensionsCell({
  item,
  onSave,
  revisionEntries = [],
  revisions = [],
}: {
  item: Item;
  onSave: SaveItemPatch;
  revisionEntries?: ProposalItemChangelogEntry[] | undefined;
  revisions?: ProposalRevision[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RevisionIndicatorWrap entries={revisionEntries} revisions={revisions}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md px-1 py-0.5 text-left text-sm text-gray-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {item.dimensions?.trim() ? (
            item.dimensions
          ) : (
            <span className="text-gray-400">Set dimensions</span>
          )}
        </button>
      </RevisionIndicatorWrap>
      <DimensionEditorModal
        open={open}
        title="Set dimensions"
        onClose={() => setOpen(false)}
        onSave={({ label }) => {
          setOpen(false);
          void saveValidatedPatch(onSave, item, { dimensions: label || null });
        }}
      />
    </>
  );
}

function RowActionsCell({ item, actions }: { item: Item; actions: TableActions }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const targetRooms = actions.rooms.filter((room) => room.id !== item.roomId);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menuRect = triggerRef.current?.getBoundingClientRect();

  return (
    <>
      <span className="inline-flex items-center">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Open item actions for ${item.itemName}`}
          aria-expanded={open}
          title={`Open item actions for ${item.itemName}`}
          onClick={() => setOpen((current) => !current)}
          className="rounded px-2 py-1 text-gray-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <MoreIcon />
        </button>
        {open &&
          menuRect &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: 'fixed',
                top: menuRect.bottom + 4,
                right: window.innerWidth - menuRect.right,
              }}
              className="z-[100] min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-md"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void actions.onDuplicate(item);
                }}
                className={menuItemClassName}
              >
                Duplicate
              </button>
              {targetRooms.length > 0 && (
                <div className="border-t border-gray-100 pt-1">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Move to location
                  </div>
                  {targetRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        void actions.onMove(item, room.id);
                      }}
                      className={menuItemClassName}
                    >
                      {room.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setConfirmDelete(true);
                }}
                className={cn(menuItemClassName, 'text-danger-600')}
              >
                Remove from FF&amp;E
              </button>
            </div>,
            document.body,
          )}
      </span>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Remove ${item.itemName} from FF&E?`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            This removes the item from the FF&amp;E table only. It stays in the Project database and
            Proposal table.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setConfirmDelete(false);
                void actions.onDelete(item);
              }}
            >
              Remove from FF&amp;E
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const menuItemClassName =
  'flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

function ChevronIcon({ direction = 'down' }: { direction?: 'down' | 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        'h-4 w-4 transition-transform',
        direction === 'left' && 'rotate-90',
        direction === 'right' && '-rotate-90',
      )}
    >
      <path
        d="m5.5 8 4.5 4.5L14.5 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="7" cy="5" r="1.2" />
      <circle cx="13" cy="5" r="1.2" />
      <circle cx="7" cy="10" r="1.2" />
      <circle cx="13" cy="10" r="1.2" />
      <circle cx="7" cy="15" r="1.2" />
      <circle cx="13" cy="15" r="1.2" />
    </svg>
  );
}

function ExpandIcon({ expanded }: { expanded?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      {expanded ? (
        <path
          d="M7.5 4.5v4h-4m9 7v-4h4M7.5 8.5 3.5 4.5m9 7 4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 4H4v4m8-4h4v4M8 16H4v-4m8 4h4v-4M4.5 4.5 8 8m7.5-3.5L12 8m-7.5 7.5L8 12m7.5 3.5L12 12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const createColumns = (
  onSave: SaveItemPatch,
  actions: TableActions,
  revisionIndicator?: FfeRevisionIndicator,
): ColumnDef<Item>[] => [
  {
    id: 'drag',
    header: '',
    cell: () => null,
  },
  {
    id: 'image',
    header: 'Rendering',
    cell: ({ row }) => (
      <ImageFrame
        entityType="item"
        entityId={row.original.id}
        alt={row.original.itemName}
        fallbackUrl={null}
        className="h-12 aspect-[117/75]"
        compact
      />
    ),
  },
  {
    id: 'plan',
    header: 'Plan',
    cell: ({ row }) => (
      <ImageFrame
        entityType="item_plan"
        entityId={row.original.id}
        alt={`${row.original.itemName} plan`}
        fallbackUrl={null}
        className="h-12 aspect-[103/75]"
        compact
      />
    ),
  },
  {
    accessorKey: 'itemIdTag',
    header: 'ID',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.itemIdTag}
        field="itemIdTag"
        label="ID"
        onSave={onSave}
        revisionEntries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'itemIdTag')}
        revisions={revisionIndicator?.revisions ?? []}
      />
    ),
  },
  {
    accessorKey: 'itemName',
    header: 'Name',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.itemName}
        field="itemName"
        label="Name"
        onSave={onSave}
        required
        displayClassName="font-medium text-gray-950"
        revisionEntries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'itemName')}
        revisions={revisionIndicator?.revisions ?? []}
      />
    ),
  },
  {
    accessorKey: 'description',
    header: 'Product Description',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.description}
        field="description"
        label="Product Description"
        onSave={onSave}
      />
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.category}
        field="category"
        label="Category"
        onSave={onSave}
      />
    ),
  },
  {
    accessorKey: 'dimensions',
    header: 'Dimensions',
    cell: ({ row }) => (
      <EditableDimensionsCell
        item={row.original}
        onSave={onSave}
        revisionEntries={revisionEntriesForFfeCell(
          revisionIndicator,
          row.original.id,
          'dimensions',
        )}
        revisions={revisionIndicator?.revisions ?? []}
      />
    ),
  },
  {
    id: 'materials',
    header: 'Materials',
    cell: ({ row }) => (
      <MaterialBadges
        materials={row.original.materials}
        onOpen={() => actions.onEditMaterials(row.original)}
      />
    ),
  },
  {
    accessorKey: 'qty',
    header: 'Quantity',
    cell: ({ row }) => (
      <RevisionIndicatorWrap
        entries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'qty')}
        revisions={revisionIndicator?.revisions ?? []}
      >
        <InlineNumberEdit
          value={row.original.qty}
          aria-label={`Quantity for ${row.original.itemName}`}
          parser={parseQtyInput}
          formatter={(value) => String(value)}
          onSave={(qty) => saveValidatedPatch(onSave, row.original, { qty })}
        />
      </RevisionIndicatorWrap>
    ),
  },
  {
    accessorKey: 'unitCostCents',
    header: 'Unit Cost',
    cell: ({ row }) => (
      <RevisionIndicatorWrap
        entries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'unitCostCents')}
        revisions={revisionIndicator?.revisions ?? []}
      >
        <InlineNumberEdit
          value={row.original.unitCostCents / 100}
          aria-label={`Unit Cost for ${row.original.itemName}`}
          parser={parseUnitCostDollarsInput}
          formatter={formatDollars}
          onSave={(unitCostDollars) =>
            saveValidatedPatch(onSave, row.original, {
              unitCostCents: unitCostDollarsToCents(unitCostDollars),
            })
          }
        />
      </RevisionIndicatorWrap>
    ),
  },
  {
    id: 'lineTotal',
    header: 'Total',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <span className="font-medium tabular-nums">
          {formatMoney(cents(lineTotalCents(item.unitCostCents, item.qty)))}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <EditableStatusCell item={row.original} onSave={onSave} />,
  },
  {
    accessorKey: 'leadTime',
    header: 'Lead Time',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.leadTime}
        field="leadTime"
        label="Lead Time"
        onSave={onSave}
      />
    ),
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.notes}
        field="notes"
        label="Notes"
        onSave={onSave}
        revisionEntries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'notes')}
        revisions={revisionIndicator?.revisions ?? []}
      />
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <RowActionsCell item={row.original} actions={actions} />,
  },
];

/**
 * Build the full visible column list from the user's column config.
 * Default columns are filtered/reordered by visibleOrder; custom columns
 * are appended as inline-editable text columns reading from item.customData.
 */
function buildColumns(
  onSave: SaveItemPatch,
  actions: TableActions,
  visibleOrder: string[],
  customDefs: import('../../../types').CustomColumnDef[],
  onSaveCustomCell: (item: Item, defId: string, value: string) => Promise<void>,
  onDeleteCustomDef: (defId: string) => void,
  onRenameCustomDef: (defId: string, label: string) => Promise<void>,
  revisionIndicator?: FfeRevisionIndicator,
): ColumnDef<Item>[] {
  const allDefaultCols = createColumns(onSave, actions, revisionIndicator);
  const defaultColMap = new Map(
    allDefaultCols.map((col) => [col.id ?? (col as { accessorKey?: string }).accessorKey, col]),
  );
  const customDefMap = new Map(customDefs.map((d) => [d.id, d]));

  return visibleOrder
    .map((colId): ColumnDef<Item> | null => {
      const defaultCol = defaultColMap.get(colId);
      if (defaultCol) return defaultCol;

      const def = customDefMap.get(colId);
      if (!def) return null;

      return {
        id: def.id,
        header: () => (
          <CustomColumnHeader
            def={def}
            onDelete={() => onDeleteCustomDef(def.id)}
            onRename={(label) => onRenameCustomDef(def.id, label)}
          />
        ),
        cell: ({ row }) => (
          <InlineTextEdit
            value={row.original.customData[def.id] ?? ''}
            aria-label={`${def.label} for ${row.original.itemName}`}
            onSave={(value) => onSaveCustomCell(row.original, def.id, value)}
            renderDisplay={(v) =>
              v.trim().length > 0 ? <span>{v}</span> : <span className="text-gray-400">-</span>
            }
          />
        ),
      };
    })
    .filter((col): col is ColumnDef<Item> => col !== null);
}

function useCollapsedRooms(rooms: RoomWithItems[]) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rooms.map((room) => [room.id, readRoomCollapsed(room.id)])),
  );

  const toggle = (roomId: string) => {
    setCollapsed((current) => {
      const nextValue = !current[roomId];
      writeRoomCollapsed(roomId, nextValue);
      return { ...current, [roomId]: nextValue };
    });
  };

  return { collapsed, toggle };
}

function readRoomCollapsed(roomId: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`room:${roomId}:collapsed`) === 'true';
}

function writeRoomCollapsed(roomId: string, value: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`room:${roomId}:collapsed`, String(value));
}

function useCollapsedRoomImages(rooms: RoomWithItems[]) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rooms.map((room) => [room.id, true])),
  );

  const toggle = (roomId: string) => {
    setCollapsed((current) => {
      const nextValue = !current[roomId];
      return { ...current, [roomId]: nextValue };
    });
  };

  return { collapsed, toggle };
}

function ItemsErrorState({ onReload }: { onReload?: (() => void) | undefined }) {
  return (
    <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-lg border border-danger-500/30 bg-white px-6 py-10 text-center">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">Items could not be loaded</h2>
        <p className="mt-1 text-sm text-gray-600">Reload the table to try the request again.</p>
      </div>
      <Button type="button" variant="secondary" onClick={onReload}>
        Reload
      </Button>
    </div>
  );
}

function ItemsLoadingState() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="h-9 border-b border-neutral-200 bg-neutral-50" />
      <div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            data-testid="items-table-shimmer-row"
            className="grid h-13 grid-cols-6 items-center gap-4 border-b border-neutral-200/60 px-4"
          >
            <div className="col-span-2 h-3 rounded bg-neutral-100" />
            <div className="h-3 rounded bg-neutral-100" />
            <div className="h-3 rounded bg-neutral-100" />
            <div className="h-3 rounded bg-neutral-100" />
            <div className="h-3 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyProjectState({ onAddRoom }: { onAddRoom?: (() => void) | undefined }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <h2 className="font-display text-2xl text-neutral-900">No locations yet</h2>
        <p className="max-w-md text-sm text-neutral-600">
          Locations and FF&amp;E items will appear here once this project has a location schedule.
        </p>
        {onAddRoom && (
          <Button type="button" variant="secondary" onClick={onAddRoom}>
            Add location
          </Button>
        )}
      </div>
    </div>
  );
}

function DeleteRoomModal({
  room,
  open,
  onClose,
  onConfirm,
}: {
  room: RoomWithItems | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const itemCount = room?.items.length ?? 0;
  const hasItems = itemCount > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? `Remove ${room.name} from FF&E?` : 'Remove location from FF&E'}
    >
      <div className="flex flex-col gap-4">
        {hasItems ? (
          <p className="text-sm text-gray-600">
            <strong>{room?.name}</strong> has {itemCount} {itemCount === 1 ? 'item' : 'items'}. This
            removes the location and its items from the FF&amp;E table only. They stay in the
            Project database and Proposal table.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            This removes the empty location from the FF&amp;E table without deleting the database
            row.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              void Promise.resolve(onConfirm()).then(() => {
                onClose();
              });
            }}
          >
            Remove from FF&amp;E
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SortableItemRow({
  row,
  density,
  onItemClick,
}: {
  row: Row<Item>;
  density: TableDensity;
  onItemClick?: (item: Item) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.original.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border-b border-neutral-200/60',
        densityRowClass(density),
        isDragging && 'bg-brand-50 shadow-md',
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={cn(
            'px-3 py-3 text-gray-700',
            cell.column.id === 'description' ? 'min-w-64 whitespace-normal' : 'whitespace-nowrap',
            cell.column.id === 'plan' && 'w-24 min-w-24 max-w-24 overflow-hidden',
            cell.column.id === 'lineTotal' && stickyTotalCellClassName,
            cell.column.id === 'actions' && stickyActionsCellClassName,
          )}
        >
          {cell.column.id === 'drag' ? (
            <button
              type="button"
              aria-label={`Drag ${row.original.itemName}`}
              className="cursor-grab rounded px-1 text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              {...attributes}
              {...listeners}
            >
              <GripIcon />
            </button>
          ) : cell.column.id === 'actions' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`View details for ${row.original.itemName}`}
                title="View details"
                onClick={() => onItemClick?.(row.original)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <EyeIcon />
              </button>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </td>
      ))}
    </tr>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function MobileItemCards({
  items,
  actions,
  onSave,
  revisionIndicator,
}: {
  items: Item[];
  actions: TableActions;
  onSave: SaveItemPatch;
  revisionIndicator?: FfeRevisionIndicator;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
        Add first item -&gt;
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <ImageFrame
                entityType="item"
                entityId={item.id}
                alt={item.itemName}
                fallbackUrl={null}
                className="h-14 aspect-[117/75] shrink-0"
                compact
              />
              <div className="min-w-0">
                <EditableTextCell
                  item={item}
                  value={item.itemName}
                  field="itemName"
                  label="Name"
                  onSave={onSave}
                  required
                  displayClassName="text-base font-semibold text-gray-950"
                  revisionEntries={revisionEntriesForFfeCell(
                    revisionIndicator,
                    item.id,
                    'itemName',
                  )}
                  revisions={revisionIndicator?.revisions ?? []}
                />
                <div className="mt-1 text-sm text-gray-500">
                  <EditableTextCell
                    item={item}
                    value={item.itemIdTag}
                    field="itemIdTag"
                    label="ID"
                    onSave={onSave}
                    revisionEntries={revisionEntriesForFfeCell(
                      revisionIndicator,
                      item.id,
                      'itemIdTag',
                    )}
                    revisions={revisionIndicator?.revisions ?? []}
                  />
                </div>
              </div>
            </div>
            <RowActionsCell item={item} actions={actions} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MobileField label="Category">
              <EditableTextCell
                item={item}
                value={item.category}
                field="category"
                label="Category"
                onSave={onSave}
              />
            </MobileField>
            <MobileField label="Materials">
              <MaterialBadges
                materials={item.materials}
                onOpen={() => actions.onEditMaterials(item)}
              />
            </MobileField>
            <MobileField label="Quantity">
              <RevisionIndicatorWrap
                entries={revisionEntriesForFfeCell(revisionIndicator, item.id, 'qty')}
                revisions={revisionIndicator?.revisions ?? []}
              >
                <InlineNumberEdit
                  value={item.qty}
                  aria-label={`Quantity for ${item.itemName}`}
                  parser={parseQtyInput}
                  formatter={(value) => String(value)}
                  onSave={(qty) => saveValidatedPatch(onSave, item, { qty })}
                />
              </RevisionIndicatorWrap>
            </MobileField>
            <MobileField label="Unit cost">
              <RevisionIndicatorWrap
                entries={revisionEntriesForFfeCell(revisionIndicator, item.id, 'unitCostCents')}
                revisions={revisionIndicator?.revisions ?? []}
              >
                <InlineNumberEdit
                  value={item.unitCostCents / 100}
                  aria-label={`Unit Cost for ${item.itemName}`}
                  parser={parseUnitCostDollarsInput}
                  formatter={formatDollars}
                  onSave={(unitCostDollars) =>
                    saveValidatedPatch(onSave, item, {
                      unitCostCents: unitCostDollarsToCents(unitCostDollars),
                    })
                  }
                />
              </RevisionIndicatorWrap>
            </MobileField>
            <MobileField label="Total">
              <span className="font-semibold tabular-nums">
                {formatMoney(cents(lineTotalCents(item.unitCostCents, item.qty)))}
              </span>
            </MobileField>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <EditableStatusCell item={item} onSave={onSave} />
            <EditableTextCell
              item={item}
              value={item.notes}
              field="notes"
              label="Notes"
              onSave={onSave}
              revisionEntries={revisionEntriesForFfeCell(revisionIndicator, item.id, 'notes')}
              revisions={revisionIndicator?.revisions ?? []}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-1 text-gray-950">{children}</div>
    </div>
  );
}

function RoomActionsMenu({
  room,
  rooms,
  project,
  columnDefs,
  hiddenDefaults,
  onDeleteRoom,
  onAddItem,
  onRestoreDefault,
  onOpenAddColumnModal,
}: {
  room: RoomWithItems;
  rooms: RoomWithItems[];
  project?: Project;
  columnDefs: import('../../../types').CustomColumnDef[];
  hiddenDefaults: { id: string; label: string }[];
  onDeleteRoom: () => void;
  onAddItem: () => void;
  onRestoreDefault: (id: string) => void;
  onOpenAddColumnModal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [columnSubmenuOpen, setColumnSubmenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const columnTriggerRef = useRef<HTMLButtonElement>(null);
  const columnSubmenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      const inSubmenu = columnSubmenuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu && !inSubmenu) {
        setOpen(false);
        setColumnSubmenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open options for ${room.name}`}
        title={`Open options for ${room.name}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreIcon />
      </button>
      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              right: window.innerWidth - triggerRect.right,
            }}
            className="z-[100] min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onAddItem)}
            >
              Add item
            </button>
            <div className="relative">
              <button
                ref={columnTriggerRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={columnSubmenuOpen}
                className={cn(menuItemClassName, 'justify-between')}
                onClick={() => setColumnSubmenuOpen((v) => !v)}
              >
                Add column
                <ChevronIcon direction="right" />
              </button>
              {columnSubmenuOpen &&
                columnTriggerRef.current &&
                createPortal(
                  <div
                    ref={columnSubmenuRef}
                    role="menu"
                    style={{
                      position: 'fixed',
                      top: columnTriggerRef.current.getBoundingClientRect().top,
                      right:
                        window.innerWidth -
                        columnTriggerRef.current.getBoundingClientRect().left +
                        4,
                    }}
                    className="z-50 min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                  >
                    {hiddenDefaults.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        role="menuitem"
                        className={menuItemClassName}
                        onClick={() => {
                          setColumnSubmenuOpen(false);
                          setOpen(false);
                          onRestoreDefault(col.id);
                        }}
                      >
                        {col.label}
                      </button>
                    ))}
                    {hiddenDefaults.length > 0 && <div className="my-1 h-px bg-gray-100" />}
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClassName}
                      onClick={() => {
                        setColumnSubmenuOpen(false);
                        setOpen(false);
                        onOpenAddColumnModal();
                      }}
                    >
                      Add custom column...
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
            <div className="my-1 h-px bg-gray-100" />
            {project && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName}
                  onClick={() => runAction(() => exportTableCsv(project, rooms, room, columnDefs))}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName}
                  onClick={() =>
                    runAction(() => void exportTableExcel(project, rooms, room, columnDefs))
                  }
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName}
                  onClick={() =>
                    runAction(() => void exportTablePdf(project, rooms, room, columnDefs))
                  }
                >
                  Export PDF
                </button>
                <div className="my-1 h-px bg-gray-100" />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              className={cn(menuItemClassName, 'text-danger-600')}
              onClick={() => runAction(onDeleteRoom)}
            >
              Remove from FF&amp;E
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function RoomItemsSection({
  room,
  rooms,
  projectId,
  project,
  collapsed,
  imageCollapsed,
  onToggle,
  onToggleImage,
  onDeleteRoom,
}: {
  room: RoomWithItems;
  rooms: RoomWithItems[];
  projectId: string;
  project?: Project;
  collapsed: boolean;
  imageCollapsed: boolean;
  onToggle: () => void;
  onToggleImage: () => void;
  onDeleteRoom: (room: RoomWithItems) => void;
}) {
  const updateItem = useUpdateItem(room.id);
  const updateRoom = useUpdateRoom(projectId);
  const createItem = useCreateItem(room.id);
  const deleteItem = useDeleteItem(room.id);
  const moveItem = useMoveItem();
  const projectMaterials = useMaterials(projectId);
  const materialActions = useItemMaterialActions({ kind: 'ffe', itemGroupId: room.id, projectId });
  const { data: revisionsData } = useProposalRevisions(projectId);
  const { data: columnDefs = [] } = useItemColumnDefs(projectId);
  const createColumnDef = useCreateItemColumnDef(projectId);
  const updateColumnDef = useUpdateItemColumnDef(projectId);
  const deleteColumnDef = useDeleteItemColumnDef(projectId);
  const columnConfig = useColumnConfig(projectId, 'ffe', DEFAULT_COLUMN_IDS, columnDefs, 'qty');
  const { density } = useTableDensity();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [materialItem, setMaterialItem] = useState<Item | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  type PendingChange = GeneratedItemChangeInfo & {
    item: Item;
    patch: EditableItemPatch;
  };
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const isMobile = useIsMobileViewport();
  const proposalStatus = project?.proposalStatus ?? 'in_progress';
  const openRevision = useMemo(
    () => revisionsData?.revisions.find((revision) => revision.closedAt === null) ?? null,
    [revisionsData?.revisions],
  );
  const revisions = useMemo(() => revisionsData?.revisions ?? [], [revisionsData?.revisions]);
  const changelogByGeneratedItemId = useMemo(() => {
    const map = new Map<string, ProposalItemChangelogEntry[]>();
    const currentRevisionIds = new Set(revisions.map((revision) => revision.id));
    for (const entry of revisionsData?.changelog ?? []) {
      if (
        !entry.generatedItemId ||
        !entry.revisionId ||
        !currentRevisionIds.has(entry.revisionId)
      ) {
        continue;
      }
      if (!map.has(entry.generatedItemId)) map.set(entry.generatedItemId, []);
      map.get(entry.generatedItemId)!.push(entry);
    }
    return map;
  }, [revisions, revisionsData?.changelog]);
  const revisionIndicator = useMemo<FfeRevisionIndicator>(
    () => ({ revisions, changelogByGeneratedItemId }),
    [changelogByGeneratedItemId, revisions],
  );
  const shouldConfirmProposalImpact = proposalStatus !== 'in_progress' || openRevision !== null;
  const sortedItems = useMemo(
    () =>
      [...room.items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName),
      ),
    [room.items],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const existingCategories = useMemo(
    () =>
      Array.from(
        new Set(
          rooms.flatMap((candidate) =>
            candidate.items
              .map((item) => item.category)
              .filter((category): category is string => Boolean(category)),
          ),
        ),
      ).sort(),
    [rooms],
  );
  const roomMaterialIds = useMemo(
    () =>
      Array.from(
        new Set(
          room.items.flatMap((candidate) => candidate.materials.map((material) => material.id)),
        ),
      ),
    [room.items],
  );
  const duplicateItem = useCallback(
    async (item: Item) => {
      await createItem.mutateAsync({
        itemName: item.itemName,
        description: item.description,
        category: item.category,
        itemIdTag: item.itemIdTag,
        dimensions: item.dimensions,
        notes: item.notes,
        qty: item.qty,
        unitCostCents: item.unitCostCents,
        leadTime: item.leadTime,
        status: item.status,
        sortOrder: sortedItems.length,
      });
    },
    [createItem, sortedItems.length],
  );
  const actions = useMemo<TableActions>(
    () => ({
      rooms,
      onDuplicate: duplicateItem,
      onMove: async (item, toRoomId) => {
        await moveItem.mutateAsync({
          id: item.id,
          fromRoomId: item.roomId,
          toRoomId,
          version: item.version,
        });
      },
      onDelete: async (item) => {
        await deleteItem.mutateAsync(item.id);
      },
      onEditMaterials: (item) => setMaterialItem(item),
    }),
    [deleteItem, duplicateItem, moveItem, rooms],
  );
  const saveItemPatch = useCallback<SaveItemPatch>(
    async (item, patch) => {
      const changeInfo = ffePatchToGeneratedItemChangeInfo(patch, item);
      if (shouldConfirmProposalImpact && changeInfo) {
        setPendingChange({ ...changeInfo, item, patch });
        return;
      }

      await updateItem.mutateAsync({
        id: item.id,
        patch: { ...patch, version: item.version },
      });
    },
    [shouldConfirmProposalImpact, updateItem],
  );
  const handleConfirmChange = useCallback(
    async (result: ChangeConfirmResult) => {
      if (!pendingChange) return;

      const { item, patch, columnKey, previousValue, newValue, isPriceAffecting } = pendingChange;
      const changeLog: NonNullable<UpdateItemInput['changeLog']> = {
        columnKey,
        previousValue,
        newValue,
        proposalStatus,
        isPriceAffecting: isPriceAffecting || result.isPriceAffecting,
      };
      if (result.notes) changeLog.notes = result.notes;

      await updateItem.mutateAsync({
        id: item.id,
        patch: {
          ...patch,
          version: item.version,
          changeLog,
        },
      });
      setPendingChange(null);
    },
    [pendingChange, proposalStatus, updateItem],
  );
  const saveCustomCell = useCallback(
    async (item: Item, defId: string, value: string) => {
      await updateItem.mutateAsync({
        id: item.id,
        patch: { customData: { [defId]: value }, version: item.version },
      });
    },
    [updateItem],
  );
  const handleDeleteCustomDef = useCallback(
    (defId: string) => {
      void deleteColumnDef.mutateAsync(defId);
    },
    [deleteColumnDef],
  );
  const handleRenameCustomDef = useCallback(
    async (defId: string, label: string) => {
      await updateColumnDef.mutateAsync({ defId, patch: { label } });
    },
    [updateColumnDef],
  );
  const columns = useMemo(
    () =>
      buildColumns(
        saveItemPatch,
        actions,
        columnConfig.visibleOrder,
        columnDefs,
        saveCustomCell,
        handleDeleteCustomDef,
        handleRenameCustomDef,
        revisionIndicator,
      ),
    [
      actions,
      saveItemPatch,
      columnConfig.visibleOrder,
      columnDefs,
      saveCustomCell,
      handleDeleteCustomDef,
      handleRenameCustomDef,
      revisionIndicator,
    ],
  );
  const hiddenDefaultColumns = useMemo(
    () =>
      columnConfig.hiddenDefaults.map((id) => ({
        id,
        label: DEFAULT_COLUMN_LABELS[id as DefaultColumnId] ?? id,
      })),
    [columnConfig.hiddenDefaults],
  );
  const table = useReactTable({
    data: sortedItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const subtotal = roomSubtotalCents(room.items);
  const itemCount = room.items.length;
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const patches = getSortOrderPatches(sortedItems, String(active.id), String(over.id));
    void (async () => {
      for (const { item, sortOrder } of patches) {
        await updateItem.mutateAsync({ id: item.id, patch: { sortOrder, version: item.version } });
      }
    })();
  };
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    columnConfig.moveColumn(String(active.id), String(over.id));
  };

  return (
    <GroupedTableSection>
      <GroupedTableHeader>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${room.name}`}
            title={`${collapsed ? 'Expand' : 'Collapse'} ${room.name}`}
            className="shrink-0 rounded px-1 text-xs text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronIcon direction={collapsed ? 'right' : 'down'} />
          </button>
          <InlineTextEdit
            value={room.name}
            onSave={async (name) => {
              await updateRoom.mutateAsync({ id: room.id, patch: { name } });
            }}
            aria-label="Location name"
            renderDisplay={(v) => (
              <span className="truncate text-sm font-semibold text-gray-950">{v}</span>
            )}
            inputClassName="text-sm font-semibold text-gray-950 border-gray-300 bg-white"
          />
          <span className="shrink-0 rounded-pill bg-white px-2 py-0.5 text-xs text-gray-600">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          {openRevision && (
            <span className="shrink-0 rounded-pill border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Revision {openRevision.label} open - resolve costs in Proposal
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
          {formatMoney(cents(subtotal))}
        </span>
        <div className="flex items-center gap-1">
          <RoomActionsMenu
            room={room}
            rooms={rooms}
            {...(project !== undefined ? { project } : {})}
            columnDefs={columnDefs}
            hiddenDefaults={hiddenDefaultColumns}
            onDeleteRoom={() => onDeleteRoom(room)}
            onAddItem={() => setAddDrawerOpen(true)}
            onRestoreDefault={(id) => columnConfig.restoreDefaultColumn(id)}
            onOpenAddColumnModal={() => setAddColumnModalOpen(true)}
          />
          {!isMobile && !collapsed && (
            <button
              type="button"
              aria-label="Expand table view"
              title="Expand table view"
              onClick={() => setIsExpanded(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <ExpandIcon />
            </button>
          )}
        </div>
      </GroupedTableHeader>

      <AddItemDrawer
        open={addDrawerOpen}
        projectId={projectId}
        roomId={room.id}
        roomName={room.name}
        existingCategories={existingCategories}
        existingMaterials={projectMaterials.data ?? []}
        priorityMaterialIds={roomMaterialIds}
        onClose={() => setAddDrawerOpen(false)}
        onSubmit={async (input, materials) => {
          const createdItem = await createItem.mutateAsync({
            ...input,
            sortOrder: sortedItems.length,
          });
          await assignMaterialsToItem(
            createdItem.id,
            materials,
            materialActions.assign.mutateAsync,
            materialActions.createAndAssign.mutateAsync,
          );
        }}
      />

      {materialItem && (
        <MaterialLibraryModal
          open
          context="ffe"
          projectId={projectId}
          roomId={room.id}
          item={materialItem}
          priorityMaterialIds={roomMaterialIds}
          onClose={() => setMaterialItem(null)}
        />
      )}

      {!collapsed && isMobile && (
        <div className="grid gap-3 p-3">
          <button
            type="button"
            className="w-fit rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            onClick={onToggleImage}
            aria-expanded={!imageCollapsed}
            title={imageCollapsed ? 'Show location image' : 'Hide location image'}
          >
            {imageCollapsed ? 'Show location image' : 'Hide location image'}
          </button>
          {!imageCollapsed && (
            <ImageFrame
              entityType="room"
              entityId={room.id}
              alt={`${room.name} location`}
              className="h-40 w-full"
            />
          )}
          <MobileItemCards
            items={sortedItems}
            actions={actions}
            onSave={saveItemPatch}
            revisionIndicator={revisionIndicator}
          />
        </div>
      )}

      {!collapsed && !isMobile && (
        <div className="relative flex items-stretch">
          <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-100 bg-white">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              onClick={onToggleImage}
              aria-expanded={!imageCollapsed}
              aria-label={imageCollapsed ? 'Show location image' : 'Hide location image'}
              title={imageCollapsed ? 'Show location image' : 'Hide location image'}
            >
              <ChevronIcon direction={imageCollapsed ? 'right' : 'left'} />
            </button>
          </div>
          {!imageCollapsed && (
            <div className="h-[22rem] w-80 min-w-48 max-w-[50%] shrink-0 resize-x overflow-auto border-r border-gray-100 p-3 xl:w-96">
              <ImageFrame
                entityType="room"
                entityId={room.id}
                alt={`${room.name} location`}
                className="h-full w-full"
              />
            </div>
          )}
          <div
            tabIndex={0}
            aria-label={`${room.name} items table`}
            className="max-h-[22rem] min-w-0 flex-1 overflow-auto"
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead className="sticky top-0 z-30 text-left bg-surface">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleColumnDragEnd}
                  >
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        <SortableContext
                          items={columnConfig.visibleOrder.filter(
                            (id) => id !== 'drag' && id !== 'actions' && id !== 'lineTotal',
                          )}
                          strategy={horizontalListSortingStrategy}
                        >
                          {headerGroup.headers.map((header) => {
                            const colId = header.column.id;
                            if (colId === 'drag') {
                              return (
                                <th
                                  key={header.id}
                                  className="h-10 border-y border-neutral-200 w-10 min-w-10"
                                />
                              );
                            }
                            if (colId === 'lineTotal') {
                              return (
                                <th
                                  key={header.id}
                                  className={cn(
                                    'h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500',
                                    stickyTotalHeaderClassName,
                                  )}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                              );
                            }
                            if (colId === 'actions') {
                              return (
                                <th
                                  key={header.id}
                                  className={cn(
                                    'h-10 border-y border-neutral-200',
                                    stickyActionsHeaderClassName,
                                  )}
                                />
                              );
                            }
                            if ((DEFAULT_COLUMN_IDS as readonly string[]).includes(colId)) {
                              return (
                                <SortableColHeader
                                  key={header.id}
                                  colId={colId}
                                  label={header.column.columnDef.header as string}
                                  className={cn(
                                    'h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface',
                                    colId === 'plan' && 'w-24 min-w-24 max-w-24',
                                  )}
                                  onHide={() => columnConfig.hideDefaultColumn(colId)}
                                />
                              );
                            }
                            return (
                              <SortableColHeader
                                key={header.id}
                                colId={colId}
                                className="h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface min-w-36"
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </SortableColHeader>
                            );
                          })}
                        </SortableContext>
                      </tr>
                    ))}
                  </DndContext>
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-3 text-sm italic text-neutral-400"
                      >
                        No items — add one via the location menu.
                      </td>
                    </tr>
                  ) : (
                    <SortableContext
                      items={sortedItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {table.getRowModel().rows.map((row) => (
                        <SortableItemRow
                          key={row.original.id}
                          row={row}
                          density={density}
                          onItemClick={(item) => setDetailItem(item)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>
      )}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-gray-950/35 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-surface px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-950">{room.name}</h2>
                <p className="text-xs text-gray-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} - {formatMoney(cents(subtotal))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddColumnModalOpen(true)}
                >
                  Add column
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Minimize table view"
                  title="Minimize table view"
                  onClick={() => setIsExpanded(false)}
                >
                  <ExpandIcon expanded />
                  Minimize
                </Button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)] gap-0">
              <aside className="border-r border-gray-100 bg-surface-muted p-4">
                <ImageFrame
                  entityType="room"
                  entityId={room.id}
                  alt={`${room.name} location`}
                  className="h-72 w-full"
                />
              </aside>
              <div
                tabIndex={0}
                aria-label={`${room.name} expanded items table`}
                className="min-w-0 overflow-auto"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <table className="w-full min-w-[1180px] border-collapse text-sm">
                    <thead className="sticky top-0 z-30 text-left bg-surface">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleColumnDragEnd}
                      >
                        {table.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id}>
                            <SortableContext
                              items={columnConfig.visibleOrder.filter(
                                (id) => id !== 'drag' && id !== 'actions' && id !== 'lineTotal',
                              )}
                              strategy={horizontalListSortingStrategy}
                            >
                              {headerGroup.headers.map((header) => {
                                const colId = header.column.id;
                                if (colId === 'drag') {
                                  return (
                                    <th
                                      key={header.id}
                                      className="h-10 border-y border-neutral-200 w-10 min-w-10"
                                    />
                                  );
                                }
                                if (colId === 'lineTotal') {
                                  return (
                                    <th
                                      key={header.id}
                                      className={cn(
                                        'h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500',
                                        stickyTotalExpandedHeaderClassName,
                                      )}
                                    >
                                      {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext(),
                                      )}
                                    </th>
                                  );
                                }
                                if (colId === 'actions') {
                                  return (
                                    <th
                                      key={header.id}
                                      className={cn(
                                        'h-10 border-y border-neutral-200',
                                        stickyActionsExpandedHeaderClassName,
                                      )}
                                    />
                                  );
                                }
                                if ((DEFAULT_COLUMN_IDS as readonly string[]).includes(colId)) {
                                  return (
                                    <SortableColHeader
                                      key={header.id}
                                      colId={colId}
                                      label={header.column.columnDef.header as string}
                                      className={cn(
                                        'h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface',
                                        colId === 'plan' && 'w-24 min-w-24 max-w-24',
                                      )}
                                      onHide={() => columnConfig.hideDefaultColumn(colId)}
                                    />
                                  );
                                }
                                return (
                                  <SortableColHeader
                                    key={header.id}
                                    colId={colId}
                                    className="h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface min-w-36"
                                  >
                                    {flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                                  </SortableColHeader>
                                );
                              })}
                            </SortableContext>
                          </tr>
                        ))}
                      </DndContext>
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="px-4 py-3 text-sm italic text-neutral-400"
                          >
                            No items — add one via the location menu.
                          </td>
                        </tr>
                      ) : (
                        <SortableContext
                          items={sortedItems.map((item) => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {table.getRowModel().rows.map((row) => (
                            <SortableItemRow
                              key={row.original.id}
                              row={row}
                              density={density}
                              onItemClick={(item) => setDetailItem(item)}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </tbody>
                  </table>
                </DndContext>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailItem && (
        <FfeItemDetailPanel
          item={detailItem}
          roomName={room.name}
          onClose={() => setDetailItem(null)}
        />
      )}
      {pendingChange && (
        <ChangeConfirmModal
          columnLabel={pendingChange.columnLabel}
          previousValue={pendingChange.previousValue}
          newValue={pendingChange.newValue}
          proposalStatus={proposalStatus}
          openRevisionLabel={openRevision?.label}
          isPriceAffecting={pendingChange.isPriceAffecting}
          lockPriceAffecting={pendingChange.isPriceAffecting}
          onConfirm={(result) => void handleConfirmChange(result)}
          onCancel={() => setPendingChange(null)}
        />
      )}
      <AddColumnModal
        open={addColumnModalOpen}
        onClose={() => setAddColumnModalOpen(false)}
        onSubmit={async (label) => {
          await createColumnDef.mutateAsync({ label, sortOrder: columnDefs.length });
        }}
      />
    </GroupedTableSection>
  );
}

export function FfeTableView({
  roomsWithItems,
  projectId,
  project,
  isLoading = false,
  error = null,
  onReload,
  onImport: _onImport,
  className,
  addRoomOpen: addRoomOpenProp,
  onAddRoomOpenChange,
}: {
  roomsWithItems: RoomWithItems[];
  projectId: string;
  project?: Project;
  isLoading?: boolean | undefined;
  error?: Error | null;
  onReload?: (() => void) | undefined;
  onImport?: (() => void) | undefined;
  className?: string | undefined;
  addRoomOpen?: boolean;
  onAddRoomOpenChange?: (open: boolean) => void;
}) {
  const { collapsed, toggle } = useCollapsedRooms(roomsWithItems);
  const { collapsed: imageCollapsed, toggle: toggleImage } = useCollapsedRoomImages(roomsWithItems);
  const createRoom = useCreateRoom(projectId);
  const deleteRoom = useDeleteRoom(projectId);
  const [addRoomOpenInternal, setAddRoomOpenInternal] = useState(false);
  const isControlledAddRoom = addRoomOpenProp !== undefined && onAddRoomOpenChange !== undefined;
  const addRoomOpen = isControlledAddRoom ? (addRoomOpenProp ?? false) : addRoomOpenInternal;
  const setAddRoomOpen = isControlledAddRoom ? onAddRoomOpenChange : setAddRoomOpenInternal;
  const [roomToDelete, setRoomToDelete] = useState<RoomWithItems | null>(null);
  const sortedRooms = useMemo(
    () =>
      [...roomsWithItems].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [roomsWithItems],
  );
  const grandTotal = projectTotalCents(sortedRooms);
  const totalItemCount = sortedRooms.reduce((sum, room) => sum + room.items.length, 0);

  if (isLoading) return <ItemsLoadingState />;
  if (error) return <ItemsErrorState onReload={onReload} />;
  if (sortedRooms.length === 0) {
    return (
      <>
        <EmptyProjectState onAddRoom={projectId ? () => setAddRoomOpen(true) : undefined} />
        <AddGroupModal
          groupLabel="Location"
          open={addRoomOpen}
          onClose={() => setAddRoomOpen(false)}
          onSubmit={async (name) => {
            await createRoom.mutateAsync({ name, sortOrder: 0 });
          }}
        />
      </>
    );
  }

  return (
    <div className={cn('flex flex-1 flex-col overflow-auto', className)}>
      {sortedRooms.map((room) => (
        <RoomItemsSection
          key={room.id}
          room={room}
          rooms={sortedRooms}
          projectId={projectId}
          {...(project !== undefined ? { project } : {})}
          collapsed={collapsed[room.id] ?? false}
          imageCollapsed={imageCollapsed[room.id] ?? false}
          onToggle={() => toggle(room.id)}
          onToggleImage={() => toggleImage(room.id)}
          onDeleteRoom={setRoomToDelete}
        />
      ))}

      <TotalsBar
        itemCount={totalItemCount}
        groupCount={sortedRooms.length}
        groupLabel="locations"
        grandTotal={formatMoney(cents(grandTotal))}
      />

      <AddGroupModal
        groupLabel="Location"
        open={addRoomOpen}
        onClose={() => setAddRoomOpen(false)}
        onSubmit={async (name) => {
          await createRoom.mutateAsync({
            name,
            sortOrder: sortedRooms.length,
          });
        }}
      />

      <DeleteRoomModal
        open={roomToDelete !== null}
        room={roomToDelete}
        onClose={() => setRoomToDelete(null)}
        onConfirm={async () => {
          if (roomToDelete) {
            await deleteRoom.mutateAsync(roomToDelete.id);
          }
        }}
      />
    </div>
  );
}

export function FfeTable(props: FfeTableProps) {
  const queryClient = useQueryClient();
  const reload = () => void queryClient.invalidateQueries();

  return (
    <ItemsRenderErrorBoundary queryClient={queryClient}>
      <FfeTableView
        roomsWithItems={props.roomsWithItems}
        projectId={props.projectId}
        {...(props.project !== undefined ? { project: props.project } : {})}
        isLoading={props.isLoading}
        error={props.error ?? null}
        onReload={props.onReload ?? reload}
        onImport={props.onImport}
        className={props.className}
        {...(props.addRoomOpen !== undefined ? { addRoomOpen: props.addRoomOpen } : {})}
        {...(props.onAddRoomOpenChange !== undefined
          ? { onAddRoomOpenChange: props.onAddRoomOpenChange }
          : {})}
      />
    </ItemsRenderErrorBoundary>
  );
}
