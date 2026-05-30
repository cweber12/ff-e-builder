import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

type SortableColHeaderProps = {
  /** Column id used as the dnd-kit sortable id (must match the SortableContext items list). */
  colId: string;
  /** Display label for the column. Ignored when children are provided. */
  label?: string;
  /** Extra CSS classes applied to the <th> element. */
  className?: string;
  /** HTML rowSpan attribute — pass 2 when the header spans a two-row thead. */
  rowSpan?: number;
  /** Optional children to render in place of the label (e.g. CustomColumnHeader). */
  children?: ReactNode;
};

/**
 * A drag-sortable <th> element for use inside a SortableContext with
 * horizontalListSortingStrategy. The whole header is the drag activator: a
 * grab cursor is the only affordance (reordering is a secondary action), and
 * the activator span stays keyboard-focusable so column reordering remains
 * accessible. Hiding columns lives in the Columns panel, not the header.
 *
 * Used by both the FF&E and Proposal tables.
 */
export function SortableColHeader({
  colId,
  label,
  className,
  rowSpan,
  children,
}: SortableColHeaderProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: colId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <th ref={setNodeRef} style={style} rowSpan={rowSpan} className={cn(className, 'group')}>
      <span
        ref={setActivatorNodeRef}
        className="flex min-w-0 cursor-grab select-none items-center active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Drag to reorder ${label ?? colId} column`}
        {...attributes}
        {...listeners}
      >
        <span className="min-w-0 flex-1">{children ?? label}</span>
      </span>
    </th>
  );
}
