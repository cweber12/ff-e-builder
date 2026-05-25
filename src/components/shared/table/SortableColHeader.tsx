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
  /** Called when the user clicks the hide (×) button. Omit to suppress the button. */
  onHide?: () => void;
  /** Optional children to render in place of the label (e.g. CustomColumnHeader). */
  children?: ReactNode;
};

/**
 * A drag-sortable <th> element for use inside a SortableContext with
 * horizontalListSortingStrategy. Renders the column label (or children) and a
 * hide button that appears on hover.
 *
 * Used by both the FF&E and Proposal tables.
 */
export function SortableColHeader({
  colId,
  label,
  className,
  rowSpan,
  onHide,
  children,
}: SortableColHeaderProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: colId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <th ref={setNodeRef} style={style} rowSpan={rowSpan} className={cn(className, 'group')}>
      <span className="flex items-center gap-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 cursor-grab active:cursor-grabbing"
          aria-label={`Reorder ${label ?? colId} column`}
          title={`Reorder ${label ?? colId} column`}
          {...attributes}
          {...listeners}
        >
          <DragDotsIcon />
        </button>
        <span className="min-w-0 flex-1">{children ?? label}</span>
        {onHide && (
          <button
            type="button"
            aria-label={`Hide ${label ?? colId} column`}
            title={`Hide ${label ?? colId} column`}
            onClick={(event) => {
              event.stopPropagation();
              onHide();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="shrink-0 rounded p-0.5 text-neutral-400 opacity-70 hover:bg-danger-50 hover:text-danger-600 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </span>
    </th>
  );
}

function DragDotsIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="3" cy="3" r="1" />
      <circle cx="9" cy="3" r="1" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="9" cy="6" r="1" />
      <circle cx="3" cy="9" r="1" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  );
}
