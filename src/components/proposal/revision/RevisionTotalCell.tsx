import { cn } from '../../../lib/utils';
import { cents, formatMoney } from '../../../types';
import type { RevisionSnapshot } from '../../../types';

interface RevisionTotalCellProps {
  snapshot: RevisionSnapshot | undefined;
  tdClassName?: string;
}

export function RevisionTotalCell({ snapshot, tdClassName }: RevisionTotalCellProps) {
  const qty = snapshot?.quantity;
  const costCents = snapshot?.unitCostCents;

  if (qty === null || qty === undefined || costCents === null || costCents === undefined) {
    return (
      <td className={cn('w-[120px] min-w-[120px] px-3 py-2 text-sm text-neutral-300', tdClassName)}>
        —
      </td>
    );
  }

  const totalCents = Math.round(qty * costCents);

  return (
    <td
      className={cn(
        'w-[120px] min-w-[120px] px-3 py-2 text-sm tabular-nums font-semibold text-neutral-600',
        tdClassName,
      )}
    >
      {formatMoney(cents(totalCents))}
    </td>
  );
}
