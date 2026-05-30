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
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { cn, emptyToNull } from '../../../lib/utils';
import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../../../lib/money';
import {
  ffePatchToGeneratedItemChangeInfo,
  type GeneratedItemChangeInfo,
} from '../../../lib/table/generatedItemChangeInfo';
import { FFE_GENERATED_ITEM_TABLE_PRESET } from '../../../lib/table/generatedItemTablePresets';
import { resolveGeneratedItemColumns } from '../../../lib/table/generatedItemColumnModel';
import {
  useItemMaterialActions,
  useMaterialCellPaste,
  useFinishes,
  useCreateItem,
  useDeleteItem,
  useCreateRoom,
  useDeleteRoom,
  useFfeItemSort,
  useMaterials,
  useMoveItem,
  useReorderItems,
  useUpdateItem,
  useUpdateRoom,
  useCreateItemColumnDef,
  useDeleteItemColumnDef,
  readColumnConfigFromStorage,
  useColumnConfig,
  useGeneratedItemColumns,
  ALL_COLUMN_GROUP_ID,
  useIsMobileViewport,
  useItemColumnDefs,
  useProposalRevisions,
  useRevisionChangelog,
  useTableDensity,
  useUpdateItemColumnDef,
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
  type Material,
  type Project,
  type ProposalItemChangelogEntry,
  type ProposalRevision,
  type RoomWithItems,
} from '../../../types';
import type { CreateMaterialInput, UpdateItemInput } from '../../../lib/api';
import { exportTableCsv, exportTableExcel, exportTablePdf } from '../../../lib/export';
import { ItemStatusChip } from '../../shared/table/ItemStatusChip';
import { TotalsBar } from '../../shared/table/TotalsBar';
import { Button } from '../../primitives/Button';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { Modal } from '../../primitives/Modal';
import { DropdownMenu, MenuItem, MenuSeparator, MenuSub, MenuSubTrigger } from '../../primitives';
import { AddItemDrawer, type AddItemMaterialSelection } from './AddItemDrawer';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { MaterialLibraryModal } from '../../materials';
import {
  ColumnNavArrows,
  GroupedTableHeader,
  GroupedTableSection,
  MobileField,
  TableViewStack,
} from '../../shared/table/TableViewWrappers';
import { AddGroupModal } from '../../shared/modals/AddGroupModal';
import { FfeItemDetailPanel } from './FfeItemDetailPanel';
import { DeleteRoomModal } from './DeleteRoomModal';
import { SortableItemRow } from './SortableItemRow';
import { AddColumnModal } from '../../shared/modals/AddColumnModal';
import { GeneratedItemActionTrigger } from '../../shared/table/GeneratedItemActionControls';
import { CustomColumnHeader } from '../../shared/table/CustomColumnHeader';
import { GeneratedItemEditableNumberControl } from '../../shared/table/GeneratedItemEditableNumberCell';
import { GeneratedItemEditableTextControl } from '../../shared/table/GeneratedItemEditableTextCell';
import { GeneratedItemImageControl } from '../../shared/table/GeneratedItemImageCell';
import { GeneratedItemMaterialsControl } from '../../shared/table/GeneratedItemMaterialsCell';
import { ColumnsPanel } from '../../shared/table/ColumnsPanel';
import { ColumnGroupTabs } from '../../shared/table/ColumnGroupTabs';
import {
  GeneratedItemSizeModal,
  GeneratedItemSizeTrigger,
} from '../../shared/table/GeneratedItemSizeModal';
import { SortableColHeader } from '../../shared/table/SortableColHeader';
import { ffeStickyEdgeColumnClassNames } from '../../shared/table/generatedItemStickyStyles';
import {
  ChangeConfirmModal,
  type ChangeConfirmResult,
} from '../../shared/modals/ChangeConfirmModal';
import { GeneratedItemProposalImpactIndicatorWrap as RevisionIndicatorWrap } from '../../proposal/revision';

const DEFAULT_COLUMN_IDS = FFE_GENERATED_ITEM_TABLE_PRESET.defaultColumnIds;
const DEFAULT_COLUMN_META = FFE_GENERATED_ITEM_TABLE_PRESET.defaultColumnMeta;
const DEFAULT_COLUMN_LABELS = FFE_GENERATED_ITEM_TABLE_PRESET.defaultColumnLabels;

function defaultColumnClassName(columnId: string) {
  return DEFAULT_COLUMN_META[columnId as keyof typeof DEFAULT_COLUMN_META]?.className;
}

function defaultColumnWraps(columnId: string) {
  const meta = DEFAULT_COLUMN_META[columnId as keyof typeof DEFAULT_COLUMN_META];
  return meta != null && 'wraps' in meta && meta.wraps === true;
}

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
  | 'drawings'
  | 'description'
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
  onPasteMaterialSwatch: (item: Item, file: File) => Promise<void>;
  isMaterialPastePending: (itemId: string) => boolean;
  getMaterialFinishName: (material: Material) => string | undefined;
};

const saveValidatedPatch = (onSave: SaveItemPatch, item: Item, patch: EditableItemPatch) =>
  onSave(item, editableItemPatchSchema.parse(patch) as EditableItemPatch);

const ffeRevisionColumnKeys: Record<FfeRevisionColumnKey, string[]> = {
  itemIdTag: ['product_tag', 'productTag'],
  drawings: ['drawings'],
  description: ['description'],
  itemName: ['itemName'],
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

function EditableTextCell({
  item,
  value,
  field,
  label,
  onSave,
  required = false,
  displayClassName,
  multiline = false,
  revisionEntries = [],
  revisions = [],
}: {
  item: Item;
  value: string | null | undefined;
  field: keyof EditableItemPatch;
  label: string;
  onSave: SaveItemPatch;
  required?: boolean | undefined;
  displayClassName?: string | undefined;
  multiline?: boolean | undefined;
  revisionEntries?: ProposalItemChangelogEntry[] | undefined;
  revisions?: ProposalRevision[] | undefined;
}) {
  const current = value ?? '';

  return (
    <RevisionIndicatorWrap entries={revisionEntries} revisions={revisions}>
      <GeneratedItemEditableTextControl
        value={current}
        ariaLabel={`${label} for ${item.itemName}`}
        displayClassName={displayClassName}
        affordance="hover"
        multiline={multiline}
        normalizeValue={(nextValue) => nextValue.trim()}
        onSave={(nextValue) => {
          const patchValue = required ? nextValue : emptyToNull(nextValue);
          return saveValidatedPatch(onSave, item, { [field]: patchValue });
        }}
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
        className="rounded px-1 text-neutral-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
            className="menu-panel z-[100] min-w-36"
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
        <GeneratedItemSizeTrigger
          value={item.dimensions}
          placeholder="Set dimensions"
          variant="inline"
          onClick={() => setOpen(true)}
        />
      </RevisionIndicatorWrap>
      <GeneratedItemSizeModal
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const targetRooms = actions.rooms.filter((room) => room.id !== item.roomId);

  return (
    <>
      <DropdownMenu
        wrapperClassName="inline-flex items-center"
        panelClassName="z-[100] min-w-48"
        renderTrigger={({ triggerRef, open, toggleMenu }) => (
          <GeneratedItemActionTrigger
            ref={triggerRef}
            variant="inline"
            aria-label={`Open item actions for ${item.itemName}`}
            aria-expanded={open}
            title={`Open item actions for ${item.itemName}`}
            onClick={toggleMenu}
          />
        )}
      >
        {({ closeMenu }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                void actions.onDuplicate(item);
              }}
            >
              Duplicate
            </MenuItem>
            {targetRooms.length > 0 && (
              <div className="border-t border-neutral-200 pt-1">
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Move to location
                </div>
                {targetRooms.map((room) => (
                  <MenuItem
                    key={room.id}
                    onClick={() => {
                      closeMenu();
                      void actions.onMove(item, room.id);
                    }}
                  >
                    {room.name}
                  </MenuItem>
                ))}
              </div>
            )}
            <MenuItem
              className={cn('text-danger-600 hover:bg-red-50 hover:text-danger-700')}
              onClick={() => {
                closeMenu();
                setConfirmDelete(true);
              }}
            >
              Remove from FF&amp;E
            </MenuItem>
          </>
        )}
      </DropdownMenu>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Remove ${item.itemName} from FF&E?`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
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
    accessorKey: 'drawings',
    header: 'Drawings',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.drawings}
        field="drawings"
        label="Drawings"
        onSave={onSave}
        multiline
        revisionEntries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'drawings')}
        revisions={revisionIndicator?.revisions ?? []}
      />
    ),
  },
  {
    id: 'image',
    header: 'Rendering',
    cell: ({ row }) => (
      <GeneratedItemImageControl
        view="ffe"
        kind="rendering"
        entityId={row.original.id}
        alt={row.original.itemName}
      />
    ),
  },
  {
    id: 'plan',
    header: 'Plan',
    cell: ({ row }) => (
      <GeneratedItemImageControl
        view="ffe"
        kind="plan"
        entityId={row.original.id}
        alt={`${row.original.itemName} plan`}
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
        multiline
        revisionEntries={revisionEntriesForFfeCell(
          revisionIndicator,
          row.original.id,
          'description',
        )}
        revisions={revisionIndicator?.revisions ?? []}
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
    header: 'Size',
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
    header: 'Swatch',
    cell: ({ row }) => (
      <GeneratedItemMaterialsControl
        materials={row.original.materials}
        onOpen={() => actions.onEditMaterials(row.original)}
        onPasteImage={(file) => actions.onPasteMaterialSwatch(row.original, file)}
        isPasting={actions.isMaterialPastePending(row.original.id)}
        getFinishName={actions.getMaterialFinishName}
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
        displayClassName="font-medium text-neutral-950"
        revisionEntries={revisionEntriesForFfeCell(revisionIndicator, row.original.id, 'itemName')}
        revisions={revisionIndicator?.revisions ?? []}
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
        <GeneratedItemEditableNumberControl
          value={row.original.qty}
          ariaLabel={`Quantity for ${row.original.itemName}`}
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
        <GeneratedItemEditableNumberControl
          value={row.original.unitCostCents / 100}
          ariaLabel={`Unit Cost for ${row.original.itemName}`}
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
        multiline
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
    <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 border-y border-danger-500/40 bg-canvas-chrome px-6 py-10 text-center">
      <div>
        <h2 className="text-lg font-semibold text-neutral-950">Items could not be loaded</h2>
        <p className="mt-1 text-sm text-neutral-600">Reload the table to try the request again.</p>
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
      <div className="h-9 border-b border-neutral-200 bg-canvas-chrome" />
      <div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            data-testid="items-table-shimmer-row"
            className="grid h-13 grid-cols-6 items-center gap-4 border-b border-neutral-200 px-4"
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
      <div className="border-y border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
        Add first item -&gt;
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-sm border border-neutral-200 bg-canvas-chrome p-4 shadow-sm"
        >
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
                  displayClassName="text-base font-semibold text-neutral-950"
                  revisionEntries={revisionEntriesForFfeCell(
                    revisionIndicator,
                    item.id,
                    'itemName',
                  )}
                  revisions={revisionIndicator?.revisions ?? []}
                />
                <div className="mt-1 text-sm text-neutral-500">
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
            <MobileField label="Drawings">
              <EditableTextCell
                item={item}
                value={item.drawings}
                field="drawings"
                label="Drawings"
                onSave={onSave}
                multiline
                revisionEntries={revisionEntriesForFfeCell(revisionIndicator, item.id, 'drawings')}
                revisions={revisionIndicator?.revisions ?? []}
              />
            </MobileField>
            <MobileField label="Size">
              <EditableDimensionsCell
                item={item}
                onSave={onSave}
                revisionEntries={revisionEntriesForFfeCell(
                  revisionIndicator,
                  item.id,
                  'dimensions',
                )}
                revisions={revisionIndicator?.revisions ?? []}
              />
            </MobileField>
            <MobileField label="Swatch">
              <GeneratedItemMaterialsControl
                materials={item.materials}
                onOpen={() => actions.onEditMaterials(item)}
                onPasteImage={(file) => actions.onPasteMaterialSwatch(item, file)}
                isPasting={actions.isMaterialPastePending(item.id)}
                getFinishName={actions.getMaterialFinishName}
              />
            </MobileField>
            <MobileField label="Quantity">
              <RevisionIndicatorWrap
                entries={revisionEntriesForFfeCell(revisionIndicator, item.id, 'qty')}
                revisions={revisionIndicator?.revisions ?? []}
              >
                <GeneratedItemEditableNumberControl
                  value={item.qty}
                  ariaLabel={`Quantity for ${item.itemName}`}
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
                <GeneratedItemEditableNumberControl
                  value={item.unitCostCents / 100}
                  ariaLabel={`Unit Cost for ${item.itemName}`}
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
              multiline
              revisionEntries={revisionEntriesForFfeCell(revisionIndicator, item.id, 'notes')}
              revisions={revisionIndicator?.revisions ?? []}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function RoomActionsMenu({
  room,
  rooms,
  project,
  collapsed,
  columnDefs,
  hiddenDefaults,
  onDeleteRoom,
  onAddItem,
  onExpand,
  onRestoreDefault,
  onOpenAddColumnModal,
}: {
  room: RoomWithItems;
  rooms: RoomWithItems[];
  project?: Project;
  collapsed: boolean;
  columnDefs: import('../../../types').CustomColumnDef[];
  hiddenDefaults: { id: string; label: string }[];
  onDeleteRoom: () => void;
  onAddItem: () => void;
  onExpand: () => void;
  onRestoreDefault: (id: string) => void;
  onOpenAddColumnModal: () => void;
}) {
  return (
    <DropdownMenu
      panelClassName="z-[100] min-w-48"
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Open options for ${room.name}`}
          title={`Open options for ${room.name}`}
          onClick={toggleMenu}
          className="icon-btn"
        >
          <MoreIcon />
        </button>
      )}
    >
      {({
        closeMenu,
        submenuOpen,
        toggleSubmenu,
        submenuTriggerRef,
        submenuPanelRef,
        getSubmenuPosition,
      }) => (
        <>
          {!collapsed && (
            <>
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onExpand();
                }}
              >
                Expand table view
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem
            onClick={() => {
              closeMenu();
              onAddItem();
            }}
          >
            Add item
          </MenuItem>
          <MenuSubTrigger
            ref={submenuTriggerRef}
            aria-expanded={submenuOpen}
            className="justify-between"
            onClick={toggleSubmenu}
          >
            Add column
            <ChevronIcon direction="right" />
          </MenuSubTrigger>
          <MenuSub
            open={submenuOpen}
            panelRef={submenuPanelRef}
            position={getSubmenuPosition({ align: 'top', edge: 'left', offsetX: -4 })}
            className="z-50 min-w-44"
          >
            {hiddenDefaults.map((col) => (
              <MenuItem
                key={col.id}
                onClick={() => {
                  closeMenu();
                  onRestoreDefault(col.id);
                }}
              >
                {col.label}
              </MenuItem>
            ))}
            {hiddenDefaults.length > 0 && <MenuSeparator />}
            <MenuItem
              onClick={() => {
                closeMenu();
                onOpenAddColumnModal();
              }}
            >
              Add custom column...
            </MenuItem>
          </MenuSub>
          <MenuSeparator />
          {project && (
            <>
              <MenuItem
                onClick={() => {
                  closeMenu();
                  exportTableCsv(
                    project,
                    rooms,
                    room,
                    columnDefs,
                    readColumnConfigFromStorage(project.id, 'ffe')?.order,
                  );
                }}
              >
                Export CSV
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeMenu();
                  void exportTableExcel(
                    project,
                    rooms,
                    room,
                    columnDefs,
                    readColumnConfigFromStorage(project.id, 'ffe')?.order,
                  );
                }}
              >
                Export Excel
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeMenu();
                  void exportTablePdf(
                    project,
                    rooms,
                    room,
                    columnDefs,
                    readColumnConfigFromStorage(project.id, 'ffe')?.order,
                  );
                }}
              >
                Export PDF
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem
            className={cn('text-danger-600 hover:bg-red-50 hover:text-danger-700')}
            onClick={() => {
              closeMenu();
              onDeleteRoom();
            }}
          >
            Remove from FF&amp;E
          </MenuItem>
        </>
      )}
    </DropdownMenu>
  );
}

export function RoomHeader({
  room,
  rooms,
  collapsed,
  isMobile,
  itemCount,
  subtotal,
  openRevisionLabel,
  project,
  visibleColumns,
  customColumns,
  columnDefs,
  hiddenDefaults,
  activeColumnGroup,
  onActiveColumnGroupChange,
  onToggle,
  onSaveRoomName,
  onDeleteRoom,
  onAddItem,
  onMoveColumn,
  onHideColumn,
  onRestoreDefault,
  onRenameCustomColumn,
  onDeleteCustomColumn,
  onOpenAddColumnModal,
  onExpand,
}: {
  room: RoomWithItems;
  rooms: RoomWithItems[];
  collapsed: boolean;
  isMobile: boolean;
  itemCount: number;
  subtotal: number;
  openRevisionLabel?: string;
  project?: Project;
  visibleColumns: { id: string; label: string; isCustom?: boolean }[];
  customColumns: import('../../../types').CustomColumnDef[];
  columnDefs: import('../../../types').CustomColumnDef[];
  hiddenDefaults: { id: string; label: string }[];
  activeColumnGroup: string;
  onActiveColumnGroupChange: (groupId: string) => void;
  onToggle: () => void;
  onSaveRoomName: (name: string) => Promise<void>;
  onDeleteRoom: () => void;
  onAddItem: () => void;
  onMoveColumn: (fromId: string, toId: string) => void;
  onHideColumn: (id: string) => void;
  onRestoreDefault: (id: string) => void;
  onRenameCustomColumn: (defId: string, label: string) => Promise<void>;
  onDeleteCustomColumn: (defId: string) => void;
  onOpenAddColumnModal: () => void;
  onExpand: () => void;
}) {
  return (
    <GroupedTableHeader>
      <div className="sticky left-4 flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${room.name}`}
          title={`${collapsed ? 'Expand' : 'Collapse'} ${room.name}`}
          className="shrink-0 rounded px-1 text-xs text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <ChevronIcon direction={collapsed ? 'right' : 'down'} />
        </button>
        <InlineTextEdit
          value={room.name}
          onSave={onSaveRoomName}
          aria-label="Location name"
          renderDisplay={(value) => (
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900">
              {value}
            </span>
          )}
          inputClassName="text-sm font-semibold text-neutral-950 border-neutral-300 bg-white"
        />
        <span className="shrink-0 rounded-pill bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-black/10">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        {openRevisionLabel && (
          <span className="shrink-0 rounded-pill border border-warning-600/30 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
            Revision {openRevisionLabel} open - resolve costs in Proposal
          </span>
        )}
        {!isMobile && !collapsed && (
          <ColumnGroupTabs
            groups={FFE_GENERATED_ITEM_TABLE_PRESET.columnGroups}
            activeGroupId={activeColumnGroup}
            onChange={onActiveColumnGroupChange}
          />
        )}
      </div>
      <div className="sticky right-4 flex items-center gap-2">
        {!isMobile && !collapsed && <ColumnNavArrows />}
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-neutral-700">
          {formatMoney(cents(subtotal))}
        </span>
        <button
          type="button"
          onClick={onAddItem}
          title={`Add item to ${room.name}`}
          aria-label={`Add item to ${room.name}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <span aria-hidden="true" className="text-sm leading-none">
            +
          </span>
          Add item
        </button>
        <ColumnsPanel
          title={room.name}
          visibleColumns={visibleColumns}
          hiddenDefaults={hiddenDefaults}
          customColumns={customColumns}
          onMoveColumn={onMoveColumn}
          onHideColumn={onHideColumn}
          onRestoreDefault={onRestoreDefault}
          onRenameCustomColumn={onRenameCustomColumn}
          onDeleteCustomColumn={onDeleteCustomColumn}
          onOpenAddColumnModal={onOpenAddColumnModal}
        />
        <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <RoomActionsMenu
            room={room}
            rooms={rooms}
            {...(project !== undefined ? { project } : {})}
            collapsed={collapsed}
            columnDefs={columnDefs}
            hiddenDefaults={hiddenDefaults}
            onDeleteRoom={onDeleteRoom}
            onAddItem={onAddItem}
            onExpand={onExpand}
            onRestoreDefault={onRestoreDefault}
            onOpenAddColumnModal={onOpenAddColumnModal}
          />
        </span>
      </div>
    </GroupedTableHeader>
  );
}

export function RoomItemsSection({
  room,
  rooms,
  projectId,
  project,
  collapsed,
  imageCollapsed,
  activeColumnGroup,
  onActiveColumnGroupChange,
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
  activeColumnGroup: string;
  onActiveColumnGroupChange: (groupId: string) => void;
  onToggle: () => void;
  onToggleImage: () => void;
  onDeleteRoom: (room: RoomWithItems) => void;
}) {
  const updateItem = useUpdateItem(room.id);
  const updateRoom = useUpdateRoom(projectId);
  const createItem = useCreateItem(room.id);
  const deleteItem = useDeleteItem(room.id);
  const moveItem = useMoveItem();
  const reorderItems = useReorderItems(room.id);
  const projectMaterials = useMaterials(projectId);
  const materialActions = useItemMaterialActions({ kind: 'ffe', itemGroupId: room.id, projectId });
  const materialCellPaste = useMaterialCellPaste(projectId, {
    kind: 'ffe',
    itemGroupId: room.id,
    projectId,
  });
  const finishes = useFinishes(projectId);
  const { data: revisions = [] } = useProposalRevisions(projectId);
  const { data: changelogAll = [] } = useRevisionChangelog(projectId);
  const { data: columnDefs = [] } = useItemColumnDefs(projectId);
  const createColumnDef = useCreateItemColumnDef(projectId);
  const updateColumnDef = useUpdateItemColumnDef(projectId);
  const deleteColumnDef = useDeleteItemColumnDef(projectId);
  const { density } = useTableDensity();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [materialItem, setMaterialItem] = useState<Item | null>(null);
  const [activeMaterialPasteItemId, setActiveMaterialPasteItemId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  type PendingChange = GeneratedItemChangeInfo & {
    item: Item;
    patch: EditableItemPatch;
  };
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const isMobile = useIsMobileViewport();
  const proposalStatus = project?.proposalStatus ?? 'in_progress';
  const openRevision = useMemo(
    () => revisions.find((revision) => revision.closedAt === null) ?? null,
    [revisions],
  );
  const changelogByGeneratedItemId = useMemo(() => {
    const map = new Map<string, ProposalItemChangelogEntry[]>();
    const currentRevisionIds = new Set(revisions.map((revision) => revision.id));
    for (const entry of changelogAll) {
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
  }, [revisions, changelogAll]);
  const revisionIndicator = useMemo<FfeRevisionIndicator>(
    () => ({ revisions, changelogByGeneratedItemId }),
    [changelogByGeneratedItemId, revisions],
  );
  const shouldConfirmProposalImpact = proposalStatus !== 'in_progress' || openRevision !== null;
  const { sortMode } = useFfeItemSort(projectId);
  const sortedItems = useMemo(() => {
    const items = [...room.items];
    if (sortMode === 'idTag') {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      return items.sort((a, b) => {
        const aId = a.itemIdTag?.trim() ?? '';
        const bId = b.itemIdTag?.trim() ?? '';
        if (aId && bId) {
          return collator.compare(aId, bId) || a.itemName.localeCompare(b.itemName);
        }
        // Untagged items sort to the bottom, then by name among themselves.
        if (aId) return -1;
        if (bId) return 1;
        return a.itemName.localeCompare(b.itemName);
      });
    }
    return items.sort((a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName));
  }, [room.items, sortMode]);
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
  const finishNameById = useMemo(
    () => new Map((finishes.data ?? []).map((finish) => [finish.id, finish.name])),
    [finishes.data],
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
      onPasteMaterialSwatch: async (item, file) => {
        if (materialCellPaste.isPasting) return;
        setActiveMaterialPasteItemId(item.id);
        try {
          await materialCellPaste.pasteIntoCell({
            itemId: item.id,
            materials: item.materials,
            file,
          });
        } finally {
          setActiveMaterialPasteItemId((current) => (current === item.id ? null : current));
        }
      },
      isMaterialPastePending: (itemId: string) =>
        materialCellPaste.isPasting && activeMaterialPasteItemId === itemId,
      getMaterialFinishName: (material: Material) =>
        material.finishId ? finishNameById.get(material.finishId) : undefined,
    }),
    [
      activeMaterialPasteItemId,
      deleteItem,
      duplicateItem,
      finishNameById,
      materialCellPaste,
      moveItem,
      rooms,
    ],
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
  const defaultColumns = useMemo(
    () =>
      createColumns(saveItemPatch, actions, revisionIndicator).map((column) => ({
        id: String(column.id ?? (column as { accessorKey?: string }).accessorKey ?? ''),
        column,
      })),
    [actions, revisionIndicator, saveItemPatch],
  );
  const buildCustomColumn = useCallback(
    (def: import('../../../types').CustomColumnDef): ColumnDef<Item> => ({
      id: def.id,
      header: () => (
        <CustomColumnHeader
          def={def}
          onDelete={() => handleDeleteCustomDef(def.id)}
          onRename={(label) => handleRenameCustomDef(def.id, label)}
        />
      ),
      cell: ({ row }) => (
        <GeneratedItemEditableTextControl
          value={row.original.customData[def.id] ?? ''}
          ariaLabel={`${def.label} for ${row.original.itemName}`}
          affordance="hover"
          multiline
          normalizeValue={(value) => value.trim()}
          onSave={(value) => saveCustomCell(row.original, def.id, value)}
        />
      ),
    }),
    [handleDeleteCustomDef, handleRenameCustomDef, saveCustomCell],
  );
  const generatedColumns = useGeneratedItemColumns<ColumnDef<Item>>({
    projectId,
    preset: FFE_GENERATED_ITEM_TABLE_PRESET,
    customColumnDefs: columnDefs,
    defaultColumns,
    buildCustomColumn,
    insertBeforeId: 'qty',
    nonDraggableIds: ['drag', 'actions', 'lineTotal'],
    activeGroupId: activeColumnGroup,
  });
  const columns = generatedColumns.visibleColumns;
  const hiddenDefaultColumns = generatedColumns.hiddenDefaults;
  const visibleColumnsForPanel = useMemo(
    () =>
      generatedColumns.draggableColumnIds.map((columnId) => {
        const customDef = columnDefs.find((definition) => definition.id === columnId);
        if (customDef) {
          return { id: columnId, label: customDef.label, isCustom: true };
        }
        const label =
          DEFAULT_COLUMN_LABELS[columnId as keyof typeof DEFAULT_COLUMN_LABELS] ?? columnId;
        return { id: columnId, label, isCustom: false };
      }),
    [columnDefs, generatedColumns.draggableColumnIds],
  );
  const table = useReactTable({
    data: sortedItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const draggableColumnIds = generatedColumns.draggableColumnIds;
  const draggableColumnIdSet = useMemo(() => new Set(draggableColumnIds), [draggableColumnIds]);
  const sortedItemIdSet = useMemo(() => new Set(sortedItems.map((item) => item.id)), [sortedItems]);
  const subtotal = roomSubtotalCents(room.items);
  const itemCount = room.items.length;
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (draggableColumnIdSet.has(activeId) && draggableColumnIdSet.has(overId)) {
      generatedColumns.columnConfig.moveColumn(activeId, overId);
      return;
    }

    if (!sortedItemIdSet.has(activeId) || !sortedItemIdSet.has(overId)) return;
    // ID-tag sort overrides manual sortOrder, so row reordering is a no-op.
    if (sortMode === 'idTag') return;

    const oldIndex = sortedItems.findIndex((item) => item.id === activeId);
    const newIndex = sortedItems.findIndex((item) => item.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sortedItems, oldIndex, newIndex);
    reorderItems.mutate(reordered.map((item) => item.id));
  };

  return (
    <GroupedTableSection>
      <RoomHeader
        room={room}
        rooms={rooms}
        collapsed={collapsed}
        isMobile={isMobile}
        itemCount={itemCount}
        subtotal={subtotal}
        {...(openRevision ? { openRevisionLabel: openRevision.label } : {})}
        {...(project !== undefined ? { project } : {})}
        visibleColumns={visibleColumnsForPanel}
        customColumns={columnDefs}
        columnDefs={columnDefs}
        hiddenDefaults={hiddenDefaultColumns}
        activeColumnGroup={activeColumnGroup}
        onActiveColumnGroupChange={onActiveColumnGroupChange}
        onToggle={onToggle}
        onSaveRoomName={async (name) => {
          await updateRoom.mutateAsync({ id: room.id, patch: { name } });
        }}
        onDeleteRoom={() => onDeleteRoom(room)}
        onAddItem={() => setAddDrawerOpen(true)}
        onMoveColumn={generatedColumns.columnConfig.moveColumn}
        onHideColumn={generatedColumns.columnConfig.hideDefaultColumn}
        onRestoreDefault={(id) => generatedColumns.columnConfig.restoreDefaultColumn(id)}
        onRenameCustomColumn={handleRenameCustomDef}
        onDeleteCustomColumn={handleDeleteCustomDef}
        onOpenAddColumnModal={() => setAddColumnModalOpen(true)}
        onExpand={() => setIsExpanded(true)}
      />

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
          item={room.items.find((item) => item.id === materialItem.id) ?? materialItem}
          priorityMaterialIds={roomMaterialIds}
          onClose={() => setMaterialItem(null)}
        />
      )}

      {!collapsed && isMobile && (
        <div className="grid gap-3 p-3">
          <button
            type="button"
            className="w-fit rounded-md border border-neutral-200 bg-canvas-chrome px-2 py-1 text-xs font-medium text-neutral-600 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
          <aside className="sticky left-0 top-11 z-30 flex shrink-0 self-start">
            <div className="flex w-9 shrink-0 items-center justify-center border-r border-neutral-200 bg-canvas-chrome">
              <button
                type="button"
                className="icon-btn"
                onClick={onToggleImage}
                aria-expanded={!imageCollapsed}
                aria-label={imageCollapsed ? 'Show location image' : 'Hide location image'}
                title={imageCollapsed ? 'Show location image' : 'Hide location image'}
              >
                <ChevronIcon direction={imageCollapsed ? 'right' : 'left'} />
              </button>
            </div>
            {!imageCollapsed && (
              <div className="h-72 w-72 shrink-0 border-r border-neutral-200 bg-canvas-chrome p-3 xl:w-80">
                <ImageFrame
                  entityType="room"
                  entityId={room.id}
                  alt={`${room.name} location`}
                  className="h-full w-full"
                />
              </div>
            )}
          </aside>
          <div tabIndex={0} aria-label={`${room.name} items table`} className="min-w-0 flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead className="sticky top-11 z-30 text-left bg-canvas-chrome">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      <SortableContext
                        items={draggableColumnIds}
                        strategy={horizontalListSortingStrategy}
                      >
                        {headerGroup.headers.map((header) => {
                          const colId = header.column.id;
                          if (colId === 'drag') {
                            return <th key={header.id} className="table-head-cell w-10 min-w-10" />;
                          }
                          if (colId === 'lineTotal') {
                            return (
                              <th
                                key={header.id}
                                className={cn(
                                  'table-head-cell',
                                  ffeStickyEdgeColumnClassNames.totalHeader,
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
                                  'table-head-cell',
                                  ffeStickyEdgeColumnClassNames.actionsHeader,
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
                                className={cn('table-head-cell', defaultColumnClassName(colId))}
                              />
                            );
                          }
                          return (
                            <SortableColHeader
                              key={header.id}
                              colId={colId}
                              className="table-head-cell min-w-36"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </SortableColHeader>
                          );
                        })}
                      </SortableContext>
                    </tr>
                  ))}
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
                          defaultColumnClassName={defaultColumnClassName}
                          defaultColumnWraps={defaultColumnWraps}
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
        <div className="fixed inset-0 z-50 bg-neutral-950/35 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden rounded-sm border border-neutral-200 bg-canvas-chrome shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-canvas-chrome px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-neutral-950">{room.name}</h2>
                <p className="text-xs text-neutral-500">
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
              <aside className="border-r border-neutral-200 bg-canvas-shell p-4">
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
                    <thead className="sticky top-0 z-30 text-left bg-canvas-chrome">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          <SortableContext
                            items={draggableColumnIds}
                            strategy={horizontalListSortingStrategy}
                          >
                            {headerGroup.headers.map((header) => {
                              const colId = header.column.id;
                              if (colId === 'drag') {
                                return (
                                  <th key={header.id} className="table-head-cell w-10 min-w-10" />
                                );
                              }
                              if (colId === 'lineTotal') {
                                return (
                                  <th
                                    key={header.id}
                                    className={cn(
                                      'table-head-cell',
                                      ffeStickyEdgeColumnClassNames.totalExpandedHeader,
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
                                      'table-head-cell',
                                      ffeStickyEdgeColumnClassNames.actionsExpandedHeader,
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
                                    className={cn('table-head-cell', defaultColumnClassName(colId))}
                                  />
                                );
                              }
                              return (
                                <SortableColHeader
                                  key={header.id}
                                  colId={colId}
                                  className="table-head-cell min-w-36"
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </SortableColHeader>
                              );
                            })}
                          </SortableContext>
                        </tr>
                      ))}
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
                              defaultColumnClassName={defaultColumnClassName}
                              defaultColumnWraps={defaultColumnWraps}
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
  // Shared across all locations so the chosen column group stays consistent
  // while scrolling between rooms.
  const [activeColumnGroup, setActiveColumnGroup] = useState<string>(ALL_COLUMN_GROUP_ID);
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

  const { data: ffeColumnDefs = [] } = useItemColumnDefs(projectId);
  const ffeColumnConfig = useColumnConfig(
    projectId,
    FFE_GENERATED_ITEM_TABLE_PRESET.tableKey,
    DEFAULT_COLUMN_IDS,
    ffeColumnDefs,
    'qty',
  );
  const allFfeItems = useMemo(() => sortedRooms.flatMap((room) => room.items), [sortedRooms]);
  const applyFfeAutoHide = ffeColumnConfig.applyFirstLoadAutoHide;
  useEffect(() => {
    if (isLoading || allFfeItems.length === 0) return;
    const resolvedColumns = resolveGeneratedItemColumns(
      FFE_GENERATED_ITEM_TABLE_PRESET,
      allFfeItems,
      {
        customColumns: ffeColumnDefs.map((column) => ({
          id: column.id,
          label: column.label,
        })),
      },
    );
    applyFfeAutoHide(
      resolvedColumns.filter((column) => column.omitWhenEmpty).map((column) => column.id),
    );
  }, [isLoading, allFfeItems, ffeColumnDefs, applyFfeAutoHide]);

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
    <TableViewStack className={className}>
      {sortedRooms.map((room) => (
        <RoomItemsSection
          key={room.id}
          room={room}
          rooms={sortedRooms}
          projectId={projectId}
          {...(project !== undefined ? { project } : {})}
          collapsed={collapsed[room.id] ?? false}
          imageCollapsed={imageCollapsed[room.id] ?? false}
          activeColumnGroup={activeColumnGroup}
          onActiveColumnGroupChange={setActiveColumnGroup}
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
    </TableViewStack>
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
