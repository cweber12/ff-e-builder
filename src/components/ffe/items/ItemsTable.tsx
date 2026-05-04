import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import { cn } from '../../../lib/cn';
import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../../../lib/calc';
import { emptyToNull } from '../../../lib/textUtils';
import { getSortOrderPatches } from '../../../lib/itemSort';
import {
  useCreateItem,
  useDeleteItem,
  useMoveItem,
  useUpdateItem,
} from '../../../hooks/ffe/useItems';
import {
  useAssignMaterial,
  useCreateAndAssignMaterial,
  useMaterials,
} from '../../../hooks/materials/useMaterials';
import { useCreateRoom, useDeleteRoom, useUpdateRoom } from '../../../hooks/ffe/useRooms';
import {
  cents,
  dollarsToCents,
  editableItemPatchSchema,
  formatMoney,
  itemStatuses,
  parseMarkupPctInput,
  parseQtyInput,
  parseUnitCostDollarsInput,
  unitCostDollarsToCents,
  type Item,
  type ItemStatus,
  type Project,
  type RoomWithItems,
} from '../../../types';
import type { CreateMaterialInput, UpdateItemInput } from '../../../lib/api';
import { exportTableCsv, exportTableExcel, exportTablePdf } from '../../../lib/exportUtils';
import { StatusBadge } from '../../primitives/StatusBadge';
import { Button } from '../../primitives/Button';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { InlineNumberEdit } from '../../primitives/InlineNumberEdit';
import { Modal } from '../../primitives/Modal';
import { AddItemDrawer, type AddItemMaterialSelection } from '../../AddItemDrawer';
import { ImageFrame } from '../../shared/ImageFrame';
import { MaterialBadges, MaterialLibraryModal } from '../../materials/MaterialLibraryModal';
import { DimensionEditorModal } from '../../shared/DimensionEditorModal';
import {
  GroupedTableHeader,
  GroupedTableSection,
  StickyGrandTotal,
  TableViewStack,
} from '../../shared/TableViewWrappers';
import { AddGroupModal } from '../../shared/AddGroupModal';

type ItemsTableProps = {
  roomsWithItems: RoomWithItems[];
  projectId: string;
  project?: Project;
  isLoading?: boolean | undefined;
  error?: Error | null;
  onReload?: (() => void) | undefined;
  className?: string | undefined;
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

const formatPercent = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

type EditableItemPatch = Omit<UpdateItemInput, 'version'>;

type SaveItemPatch = (item: Item, patch: EditableItemPatch) => Promise<void>;

type TableActions = {
  rooms: RoomWithItems[];
  onDuplicate: (item: Item) => Promise<void>;
  onMove: (item: Item, toRoomId: string) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
  onEditMaterials: (item: Item) => void;
};

const saveValidatedPatch = (onSave: SaveItemPatch, item: Item, patch: EditableItemPatch) =>
  onSave(item, editableItemPatchSchema.parse(patch) as EditableItemPatch);

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
}: {
  item: Item;
  value: string | null;
  field: keyof EditableItemPatch;
  label: string;
  onSave: SaveItemPatch;
  required?: boolean | undefined;
  displayClassName?: string | undefined;
}) {
  const current = value ?? '';

  return (
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
  );
}

function EditableStatusCell({ item, onSave }: { item: Item; onSave: SaveItemPatch }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const saveStatus = (status: ItemStatus) =>
    saveValidatedPatch(onSave, item, {
      status,
    });

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
        onClick={() => void saveStatus(nextStatus(item.status))}
        className="rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <StatusBadge status={item.status} />
      </button>
      <button
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
      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-36 rounded-md border border-gray-200 bg-white p-1 shadow-md"
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
              <StatusBadge status={status} />
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function EditableDimensionsCell({ item, onSave }: { item: Item; onSave: SaveItemPatch }) {
  const [open, setOpen] = useState(false);
  return (
    <>
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
  const targetRooms = actions.rooms.filter((room) => room.id !== item.roomId);

  return (
    <>
      <span className="relative inline-flex items-center">
        <button
          type="button"
          aria-label={`Open item actions for ${item.itemName}`}
          aria-expanded={open}
          title={`Open item actions for ${item.itemName}`}
          onClick={() => setOpen((current) => !current)}
          className="rounded px-2 py-1 text-gray-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <MoreIcon />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-md"
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
                  Move to room
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
              Delete
            </button>
          </div>
        )}
      </span>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${item.itemName}?`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            This removes the item from the schedule. This action cannot be undone.
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
              Delete item
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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

const createColumns = (onSave: SaveItemPatch, actions: TableActions): ColumnDef<Item>[] => [
  {
    id: 'drag',
    header: '',
    cell: () => null,
  },
  {
    id: 'image',
    header: '',
    cell: ({ row }) => (
      <ImageFrame
        entityType="item"
        entityId={row.original.id}
        alt={row.original.itemName}
        fallbackUrl={row.original.imageUrl}
        onFallbackDelete={() => saveValidatedPatch(onSave, row.original, { imageUrl: null })}
        className="h-12 w-12"
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
      />
    ),
  },
  {
    accessorKey: 'itemName',
    header: 'Item',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.itemName}
        field="itemName"
        label="Item"
        onSave={onSave}
        required
        displayClassName="font-medium text-gray-950"
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
    accessorKey: 'vendor',
    header: 'Vendor',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.vendor}
        field="vendor"
        label="Vendor"
        onSave={onSave}
      />
    ),
  },
  {
    accessorKey: 'model',
    header: 'Model',
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.model}
        field="model"
        label="Model"
        onSave={onSave}
      />
    ),
  },
  {
    accessorKey: 'dimensions',
    header: 'Dimensions',
    cell: ({ row }) => <EditableDimensionsCell item={row.original} onSave={onSave} />,
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
    header: 'Qty',
    cell: ({ row }) => (
      <InlineNumberEdit
        value={row.original.qty}
        aria-label={`Qty for ${row.original.itemName}`}
        parser={parseQtyInput}
        formatter={(value) => String(value)}
        onSave={(qty) => saveValidatedPatch(onSave, row.original, { qty })}
      />
    ),
  },
  {
    accessorKey: 'unitCostCents',
    header: 'Unit Cost',
    cell: ({ row }) => (
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
    ),
  },
  {
    accessorKey: 'markupPct',
    header: 'Markup',
    cell: ({ row }) => (
      <InlineNumberEdit
        value={row.original.markupPct}
        aria-label={`Markup for ${row.original.itemName}`}
        parser={parseMarkupPctInput}
        formatter={(value) => `${formatPercent(value)}%`}
        onSave={(markupPct) => saveValidatedPatch(onSave, row.original, { markupPct })}
      />
    ),
  },
  {
    id: 'lineTotal',
    header: 'Total',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <span className="font-medium tabular-nums">
          {formatMoney(cents(lineTotalCents(item.unitCostCents, item.markupPct, item.qty)))}
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

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);

    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  return isMobile;
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            data-testid="items-table-shimmer-row"
            className="grid grid-cols-6 gap-4 px-4 py-4"
          >
            <div className="col-span-2 h-4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 animate-pulse rounded bg-gray-100" />
            <div className="h-4 animate-pulse rounded bg-gray-100" />
            <div className="h-4 animate-pulse rounded bg-gray-100" />
            <div className="h-4 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyProjectState({ onAddRoom }: { onAddRoom?: (() => void) | undefined }) {
  return (
    <div className="flex min-h-[22rem] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-950">No rooms yet</h2>
        <p className="mt-2 max-w-md text-sm text-gray-600">
          Rooms and FF&amp;E items will appear here once this project has a room schedule.
        </p>
        {onAddRoom && (
          <Button type="button" variant="secondary" onClick={onAddRoom}>
            Add room
          </Button>
        )}
      </div>
    </div>
  );
}

function DeleteRoomModal({
  room,
  rooms,
  open,
  onClose,
  onConfirm,
}: {
  room: RoomWithItems | null;
  rooms: RoomWithItems[];
  open: boolean;
  onClose: () => void;
  onConfirm: (targetRoomId: string | null) => Promise<void> | void;
}) {
  const [targetRoomId, setTargetRoomId] = useState('');
  const otherRooms = rooms.filter((candidate) => candidate.id !== room?.id);
  const itemCount = room?.items.length ?? 0;
  const needsTarget = itemCount > 0;
  const canDelete = !needsTarget || targetRoomId.length > 0;

  useEffect(() => {
    if (open) setTargetRoomId('');
  }, [open, room?.id]);

  return (
    <Modal open={open} onClose={onClose} title={room ? `Delete ${room.name}?` : 'Delete room'}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          {needsTarget
            ? `${room?.name} has ${itemCount} ${itemCount === 1 ? 'item' : 'items'}. Choose another room before deleting it.`
            : 'This room is empty and can be deleted.'}
        </p>
        {needsTarget && (
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Move items to...
            <select
              value={targetRoomId}
              onChange={(event) => setTargetRoomId(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
            >
              <option value="">Choose a room</option>
              {otherRooms.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canDelete}
            onClick={() => {
              void Promise.resolve(onConfirm(needsTarget ? targetRoomId : null)).then(() => {
                setTargetRoomId('');
                onClose();
              });
            }}
          >
            Delete room
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SortableItemRow({ row }: { row: Row<Item> }) {
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
      className={cn('hover:bg-brand-50/40', isDragging && 'bg-brand-50 shadow-md')}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="whitespace-nowrap px-3 py-3 text-gray-700">
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
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </td>
      ))}
    </tr>
  );
}

function MobileItemCards({
  items,
  actions,
  onSave,
}: {
  items: Item[];
  actions: TableActions;
  onSave: SaveItemPatch;
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
                fallbackUrl={item.imageUrl}
                onFallbackDelete={() => saveValidatedPatch(onSave, item, { imageUrl: null })}
                className="h-14 w-14 shrink-0"
                compact
              />
              <div className="min-w-0">
                <EditableTextCell
                  item={item}
                  value={item.itemName}
                  field="itemName"
                  label="Item"
                  onSave={onSave}
                  required
                  displayClassName="text-base font-semibold text-gray-950"
                />
                <div className="mt-1 text-sm text-gray-500">
                  <EditableTextCell
                    item={item}
                    value={item.itemIdTag}
                    field="itemIdTag"
                    label="ID"
                    onSave={onSave}
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
            <MobileField label="Vendor">
              <EditableTextCell
                item={item}
                value={item.vendor}
                field="vendor"
                label="Vendor"
                onSave={onSave}
              />
            </MobileField>
            <MobileField label="Materials">
              <MaterialBadges
                materials={item.materials}
                onOpen={() => actions.onEditMaterials(item)}
              />
            </MobileField>
            <MobileField label="Qty">
              <InlineNumberEdit
                value={item.qty}
                aria-label={`Qty for ${item.itemName}`}
                parser={parseQtyInput}
                formatter={(value) => String(value)}
                onSave={(qty) => saveValidatedPatch(onSave, item, { qty })}
              />
            </MobileField>
            <MobileField label="Unit cost">
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
            </MobileField>
            <MobileField label="Markup">
              <InlineNumberEdit
                value={item.markupPct}
                aria-label={`Markup for ${item.itemName}`}
                parser={parseMarkupPctInput}
                formatter={(value) => `${formatPercent(value)}%`}
                onSave={(markupPct) => saveValidatedPatch(onSave, item, { markupPct })}
              />
            </MobileField>
            <MobileField label="Total">
              <span className="font-semibold tabular-nums">
                {formatMoney(cents(lineTotalCents(item.unitCostCents, item.markupPct, item.qty)))}
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
  onDeleteRoom,
}: {
  room: RoomWithItems;
  rooms: RoomWithItems[];
  project?: Project;
  onDeleteRoom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
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
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
          {project && (
            <>
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName}
                onClick={() => runAction(() => exportTableCsv(project, rooms, room))}
              >
                Export CSV
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName}
                onClick={() => runAction(() => void exportTableExcel(project, rooms, room))}
              >
                Export Excel
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName}
                onClick={() => runAction(() => void exportTablePdf(project, rooms, room))}
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
            Delete room
          </button>
        </div>
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
  const assignMaterial = useAssignMaterial(room.id, projectId);
  const createAndAssignMaterial = useCreateAndAssignMaterial(room.id, projectId);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [materialItem, setMaterialItem] = useState<Item | null>(null);
  const isMobile = useIsMobileViewport();
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
        category: item.category,
        vendor: item.vendor,
        model: item.model,
        itemIdTag: item.itemIdTag,
        dimensions: item.dimensions,
        seatHeight: item.seatHeight,
        finishes: item.finishes,
        notes: item.notes,
        qty: item.qty,
        unitCostCents: item.unitCostCents,
        markupPct: item.markupPct,
        leadTime: item.leadTime,
        status: item.status,
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl,
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
      await updateItem.mutateAsync({
        id: item.id,
        patch: { ...patch, version: item.version },
      });
    },
    [updateItem],
  );
  const columns = useMemo(() => createColumns(saveItemPatch, actions), [actions, saveItemPatch]);
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
            aria-label="Room name"
            renderDisplay={(v) => (
              <span className="truncate text-sm font-semibold text-gray-950">{v}</span>
            )}
            inputClassName="text-sm font-semibold text-gray-950 border-gray-300 bg-white"
          />
          <span className="shrink-0 rounded-pill bg-white px-2 py-0.5 text-xs text-gray-600">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
          {formatMoney(cents(subtotal))}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Add item to ${room.name}`}
            title={`Add item to ${room.name}`}
            onClick={() => setAddDrawerOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <PlusIcon />
          </button>
          <RoomActionsMenu
            room={room}
            rooms={rooms}
            {...(project !== undefined ? { project } : {})}
            onDeleteRoom={() => onDeleteRoom(room)}
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
            assignMaterial.mutateAsync,
            createAndAssignMaterial.mutateAsync,
          );
        }}
      />

      {materialItem && (
        <MaterialLibraryModal
          open
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
            title={imageCollapsed ? 'Show room image' : 'Hide room image'}
          >
            {imageCollapsed ? 'Show room image' : 'Hide room image'}
          </button>
          {!imageCollapsed && (
            <ImageFrame
              entityType="room"
              entityId={room.id}
              alt={`${room.name} room`}
              className="h-40 w-full"
            />
          )}
          <MobileItemCards items={sortedItems} actions={actions} onSave={saveItemPatch} />
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
              aria-label={imageCollapsed ? 'Show room image' : 'Hide room image'}
              title={imageCollapsed ? 'Show room image' : 'Hide room image'}
            >
              <ChevronIcon direction={imageCollapsed ? 'right' : 'left'} />
            </button>
          </div>
          {!imageCollapsed && (
            <div className="h-[22rem] w-80 min-w-48 max-w-[50%] shrink-0 resize-x overflow-auto border-r border-gray-100 p-3 xl:w-96">
              <ImageFrame
                entityType="room"
                entityId={room.id}
                alt={`${room.name} room`}
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
                <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_rgb(243_244_246)]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="border-b border-gray-100 px-3 py-3 font-semibold"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="p-3">
                        <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                          Add first item -&gt;
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <SortableContext
                      items={sortedItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {table.getRowModel().rows.map((row) => (
                        <SortableItemRow key={row.original.id} row={row} />
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
            <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)] gap-0">
              <aside className="border-r border-gray-100 bg-surface-muted p-4">
                <ImageFrame
                  entityType="room"
                  entityId={room.id}
                  alt={`${room.name} room`}
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
                    <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_rgb(243_244_246)]">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="border-b border-gray-100 px-3 py-3 font-semibold"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {table.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="p-3">
                            <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                              Add first item -&gt;
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <SortableContext
                          items={sortedItems.map((item) => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {table.getRowModel().rows.map((row) => (
                            <SortableItemRow key={row.original.id} row={row} />
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
    </GroupedTableSection>
  );
}

export function ItemsTableView({
  roomsWithItems,
  projectId,
  project,
  isLoading = false,
  error = null,
  onReload,
  className,
}: {
  roomsWithItems: RoomWithItems[];
  projectId: string;
  project?: Project;
  isLoading?: boolean | undefined;
  error?: Error | null;
  onReload?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const { collapsed, toggle } = useCollapsedRooms(roomsWithItems);
  const { collapsed: imageCollapsed, toggle: toggleImage } = useCollapsedRoomImages(roomsWithItems);
  const createRoom = useCreateRoom(projectId);
  const deleteRoom = useDeleteRoom(projectId);
  const moveItem = useMoveItem();
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<RoomWithItems | null>(null);
  const sortedRooms = useMemo(
    () =>
      [...roomsWithItems].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [roomsWithItems],
  );
  const grandTotal = projectTotalCents(sortedRooms);

  if (isLoading) return <ItemsLoadingState />;
  if (error) return <ItemsErrorState onReload={onReload} />;
  if (sortedRooms.length === 0) {
    return (
      <>
        <EmptyProjectState onAddRoom={projectId ? () => setAddRoomOpen(true) : undefined} />
        <AddGroupModal
          groupLabel="Room"
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
      <div className="flex justify-center">
        <Button type="button" variant="secondary" onClick={() => setAddRoomOpen(true)}>
          Add room
        </Button>
      </div>

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

      <StickyGrandTotal value={formatMoney(cents(grandTotal))} />

      <AddGroupModal
        groupLabel="Room"
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
        rooms={sortedRooms}
        onClose={() => setRoomToDelete(null)}
        onConfirm={async (targetRoomId) => {
          if (roomToDelete?.items.length && targetRoomId) {
            await Promise.all(
              roomToDelete.items.map((item) =>
                moveItem.mutateAsync({
                  id: item.id,
                  fromRoomId: roomToDelete.id,
                  toRoomId: targetRoomId,
                  version: item.version,
                }),
              ),
            );
          }
          if (roomToDelete) {
            await deleteRoom.mutateAsync(roomToDelete.id);
          }
        }}
      />
    </TableViewStack>
  );
}

export function ItemsTable(props: ItemsTableProps) {
  const queryClient = useQueryClient();
  const reload = () => void queryClient.invalidateQueries();

  return (
    <ItemsRenderErrorBoundary queryClient={queryClient}>
      <ItemsTableView
        roomsWithItems={props.roomsWithItems}
        projectId={props.projectId}
        {...(props.project !== undefined ? { project: props.project } : {})}
        isLoading={props.isLoading}
        error={props.error ?? null}
        onReload={props.onReload ?? reload}
        className={props.className}
      />
    </ItemsRenderErrorBoundary>
  );
}
