import { Component, useCallback, useEffect, useMemo, useState } from 'react';
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
import { cn } from '../lib/cn';
import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../lib/calc';
import { emptyToNull } from '../lib/textUtils';
import { getSortOrderPatches } from '../lib/itemSort';
import { useCreateItem, useDeleteItem, useMoveItem, useUpdateItem } from '../hooks/useItems';
import { useCreateRoom, useDeleteRoom } from '../hooks/useRooms';
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
  type Room,
} from '../types';
import type { UpdateItemInput } from '../lib/api';
import { StatusBadge } from './primitives/StatusBadge';
import { Button } from './primitives/Button';
import { InlineTextEdit } from './primitives/InlineTextEdit';
import { InlineNumberEdit } from './primitives/InlineNumberEdit';
import { Modal } from './primitives/Modal';
import { AddItemDrawer } from './AddItemDrawer';

export type RoomWithItems = Room & { items: Item[] };

type ItemsTableProps = {
  roomsWithItems: RoomWithItems[];
  projectId: string;
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
};

const saveValidatedPatch = (onSave: SaveItemPatch, item: Item, patch: EditableItemPatch) =>
  onSave(item, editableItemPatchSchema.parse(patch) as EditableItemPatch);

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
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className="rounded px-1 text-gray-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        ...
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
          onClick={() => setOpen((current) => !current)}
          className="rounded px-2 py-1 text-gray-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          ...
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

const createColumns = (onSave: SaveItemPatch, actions: TableActions): ColumnDef<Item>[] => [
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
    cell: ({ row }) => (
      <EditableTextCell
        item={row.original}
        value={row.original.dimensions}
        field="dimensions"
        label="Dimensions"
        onSave={onSave}
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

function AddRoomModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Add room">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          void Promise.resolve(onSubmit(trimmed)).then(() => {
            setName('');
            onClose();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Room name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add room</Button>
        </div>
      </form>
    </Modal>
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
              ::
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

function RoomItemsSection({
  room,
  rooms,
  collapsed,
  onToggle,
  onDeleteRoom,
}: {
  room: RoomWithItems;
  rooms: RoomWithItems[];
  collapsed: boolean;
  onToggle: () => void;
  onDeleteRoom: (room: RoomWithItems) => void;
}) {
  const updateItem = useUpdateItem(room.id);
  const createItem = useCreateItem(room.id);
  const deleteItem = useDeleteItem(room.id);
  const moveItem = useMoveItem();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
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
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-surface-muted px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'inline-block text-xs text-gray-500 transition-transform',
                collapsed ? '-rotate-90' : 'rotate-0',
              )}
            >
              v
            </span>
            <span className="truncate text-sm font-semibold text-gray-950">{room.name}</span>
            <span className="rounded-pill bg-white px-2 py-0.5 text-xs text-gray-600">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </span>
        </button>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
          {formatMoney(cents(subtotal))}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setAddDrawerOpen(true)}>
            Add item
          </Button>
          <Button type="button" variant="ghost" onClick={() => onDeleteRoom(room)}>
            Delete room
          </Button>
        </div>
      </div>

      <AddItemDrawer
        open={addDrawerOpen}
        roomName={room.name}
        existingCategories={existingCategories}
        onClose={() => setAddDrawerOpen(false)}
        onSubmit={async (input) => {
          await createItem.mutateAsync({ ...input, sortOrder: sortedItems.length });
        }}
      />

      {!collapsed && isMobile && (
        <div className="p-3">
          <MobileItemCards items={sortedItems} actions={actions} onSave={saveItemPatch} />
        </div>
      )}

      {!collapsed && !isMobile && (
        <div tabIndex={0} aria-label={`${room.name} items table`} className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="min-w-[1120px] w-full border-collapse text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-gray-500">
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
      )}
    </section>
  );
}

export function ItemsTableView({
  roomsWithItems,
  projectId,
  isLoading = false,
  error = null,
  onReload,
  className,
}: {
  roomsWithItems: RoomWithItems[];
  projectId: string;
  isLoading?: boolean | undefined;
  error?: Error | null;
  onReload?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const { collapsed, toggle } = useCollapsedRooms(roomsWithItems);
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
        <AddRoomModal
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
    <div className={cn('relative flex flex-col gap-4 pb-16', className)}>
      {sortedRooms.map((room) => (
        <RoomItemsSection
          key={room.id}
          room={room}
          rooms={sortedRooms}
          collapsed={collapsed[room.id] ?? false}
          onToggle={() => toggle(room.id)}
          onDeleteRoom={setRoomToDelete}
        />
      ))}

      <div className="flex justify-center">
        <Button type="button" variant="secondary" onClick={() => setAddRoomOpen(true)}>
          Add room
        </Button>
      </div>

      <div className="sticky bottom-0 z-10 rounded-lg border border-brand-500/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Grand total
          </span>
          <span className="text-lg font-bold tabular-nums text-brand-700">
            {formatMoney(cents(grandTotal))}
          </span>
        </div>
      </div>

      <AddRoomModal
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
    </div>
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
        isLoading={props.isLoading}
        error={props.error ?? null}
        onReload={props.onReload ?? reload}
        className={props.className}
      />
    </ItemsRenderErrorBoundary>
  );
}
