import { cn } from '../../../lib/utils';
import type { RevisionSnapshot } from '../../../types';

interface RevisionQtyCellProps {
  snapshot: RevisionSnapshot | undefined;
  currentQuantity: number;
  currentUnit: string;
  tdClassName?: string;
}

export function RevisionQtyCell({
  snapshot,
  currentQuantity,
  currentUnit,
  tdClassName,
}: RevisionQtyCellProps) {
  const qty = snapshot?.quantity;

  if (qty === null || qty === undefined) {
    return (
      <td
        className={cn(
          'w-44 min-w-[176px] border-l-2 border-l-brand-300 px-3 py-2 text-sm text-neutral-300',
          tdClassName,
        )}
      >
        —
      </td>
    );
  }

  const changed = qty !== currentQuantity;

  return (
    <td
      className={cn(
        'w-44 min-w-[176px] border-l-2 border-l-brand-300 px-3 py-2 text-sm tabular-nums',
        changed ? 'text-amber-600' : 'text-neutral-500',
        tdClassName,
      )}
    >
      {qty} {currentUnit}
    </td>
  );
}
