import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender, type Row } from '@tanstack/react-table';
import { cn } from '../../../lib/utils';
import type { Item } from '../../../types';
import { GeneratedItemDragHandle } from '../../shared/table/GeneratedItemDragHandle';
import { ffeGeneratedItemStickyClassNames } from '../../shared/table/generatedItemStickyStyles';
import type { TableDensity } from '../../../hooks';
import { densityRowClass } from '../../../hooks';

type SortableItemRowProps = {
  row: Row<Item>;
  density: TableDensity;
  onItemClick?: (item: Item) => void;
  defaultColumnClassName: (columnId: string) => string | undefined;
  defaultColumnWraps: (columnId: string) => boolean;
};

function useSortableRowSelection(row: Row<Item>) {
  return useMemo(
    () => ({
      itemId: row.original.id,
      itemName: row.original.itemName,
      itemVersion: row.original.version,
    }),
    [row.original.id, row.original.itemName, row.original.version],
  );
}

function SortableItemRowImpl({
  row,
  density,
  onItemClick,
  defaultColumnClassName,
  defaultColumnWraps,
}: SortableItemRowProps) {
  const { itemName } = useSortableRowSelection(row);
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
      data-dragging={isDragging || undefined}
      className={cn(
        'group border-b border-neutral-200',
        densityRowClass(density),
        isDragging && 'bg-brand-50 shadow-md',
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={cn(
            'px-3 py-3 text-neutral-700',
            cell.column.id !== 'actions' && 'table-body-divider',
            defaultColumnClassName(cell.column.id),
            defaultColumnWraps(cell.column.id) ? 'whitespace-normal' : 'whitespace-nowrap',
            cell.column.id === 'plan' && 'overflow-hidden',
            ffeGeneratedItemStickyClassNames.byColumnId[cell.column.id]?.cell,
          )}
        >
          {cell.column.id === 'drag' ? (
            <GeneratedItemDragHandle
              ariaLabel={`Drag ${itemName}`}
              {...attributes}
              {...listeners}
            />
          ) : cell.column.id === 'actions' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`View details for ${itemName}`}
                title="View details"
                onClick={() => onItemClick?.(row.original)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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

export const SortableItemRow = memo(
  SortableItemRowImpl,
  (prevProps, nextProps) =>
    prevProps.row.original.id === nextProps.row.original.id &&
    prevProps.row.original.version === nextProps.row.original.version &&
    prevProps.density === nextProps.density &&
    prevProps.onItemClick === nextProps.onItemClick &&
    prevProps.defaultColumnClassName === nextProps.defaultColumnClassName &&
    prevProps.defaultColumnWraps === nextProps.defaultColumnWraps,
);

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
