import { Component, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { cn } from '../lib/cn';
import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../lib/calc';
import { useUpdateItem } from '../hooks/useItems';
import {
  cents,
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

export type RoomWithItems = Room & { items: Item[] };

type ItemsTableProps = {
  roomsWithItems: RoomWithItems[];
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

const toNullablePatch = (value: string) => (value.trim().length > 0 ? value.trim() : null);

const saveValidatedPatch = (onSave: SaveItemPatch, item: Item, patch: EditableItemPatch) =>
  onSave(item, editableItemPatchSchema.parse(patch) as EditableItemPatch);

const formatDollars = (value: number) => formatMoney(cents(Math.round(value * 100)));

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
        const patchValue = required ? nextValue.trim() : toNullablePatch(nextValue);
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

const createColumns = (onSave: SaveItemPatch): ColumnDef<Item>[] => [
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

function EmptyProjectState() {
  return (
    <div className="flex min-h-[22rem] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div>
        <h2 className="text-xl font-semibold text-gray-950">No rooms yet</h2>
        <p className="mt-2 max-w-md text-sm text-gray-600">
          Rooms and FF&amp;E items will appear here once this project has a room schedule.
        </p>
      </div>
    </div>
  );
}

function RoomItemsSection({
  room,
  collapsed,
  onToggle,
}: {
  room: RoomWithItems;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const updateItem = useUpdateItem(room.id);
  const sortedItems = useMemo(
    () =>
      [...room.items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName),
      ),
    [room.items],
  );
  const columns = useMemo(
    () =>
      createColumns(async (item, patch) => {
        await updateItem.mutateAsync({
          id: item.id,
          patch: { ...patch, version: item.version },
        });
      }),
    [updateItem],
  );
  const table = useReactTable({
    data: sortedItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const subtotal = roomSubtotalCents(room.items);
  const itemCount = room.items.length;

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-4 border-b border-gray-100 bg-surface-muted px-4 py-3 text-left"
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
        <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
          {formatMoney(cents(subtotal))}
        </span>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
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
                      No items yet
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-50/40">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="whitespace-nowrap px-3 py-3 text-gray-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ItemsTableView({
  roomsWithItems,
  isLoading = false,
  error = null,
  onReload,
  className,
}: {
  roomsWithItems: RoomWithItems[];
  isLoading?: boolean | undefined;
  error?: Error | null;
  onReload?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const { collapsed, toggle } = useCollapsedRooms(roomsWithItems);
  const sortedRooms = useMemo(
    () =>
      [...roomsWithItems].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [roomsWithItems],
  );
  const grandTotal = projectTotalCents(sortedRooms);

  if (isLoading) return <ItemsLoadingState />;
  if (error) return <ItemsErrorState onReload={onReload} />;
  if (sortedRooms.length === 0) return <EmptyProjectState />;

  return (
    <div className={cn('relative flex flex-col gap-4 pb-16', className)}>
      {sortedRooms.map((room) => (
        <RoomItemsSection
          key={room.id}
          room={room}
          collapsed={collapsed[room.id] ?? false}
          onToggle={() => toggle(room.id)}
        />
      ))}

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
        isLoading={props.isLoading}
        error={props.error ?? null}
        onReload={props.onReload ?? reload}
        className={props.className}
      />
    </ItemsRenderErrorBoundary>
  );
}
