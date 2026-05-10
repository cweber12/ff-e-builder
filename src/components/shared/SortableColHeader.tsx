import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type SortableColHeaderProps = {
  /** Column id used as the dnd-kit sortable id (must match the SortableContext items list). */
  colId: string;
  /** Display label for the column. Ignored when children are provided. */
  label?: string;
  /** Extra CSS classes applied to the <th> element. */
  className?: string;
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
  onHide,
  children,
}: SortableColHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: colId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(className, 'group cursor-grab active:cursor-grabbing')}
      {...attributes}
      {...listeners}
    >
      {children ?? (
        <span className="flex items-center gap-1">
          <span className="flex-1">{label}</span>
          {onHide && (
            <button
              type="button"
              aria-label={`Hide ${label} column`}
              title={`Hide ${label} column`}
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="hidden rounded p-0.5 text-gray-400 hover:bg-danger-50 hover:text-danger-600 group-hover:flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
      )}
    </th>
  );
}
