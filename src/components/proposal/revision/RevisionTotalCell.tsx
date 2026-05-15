import { cents, formatMoney } from '../../../types';
import type { RevisionSnapshot } from '../../../types';

interface RevisionTotalCellProps {
  snapshot: RevisionSnapshot | undefined;
}

export function RevisionTotalCell({ snapshot }: RevisionTotalCellProps) {
  const qty = snapshot?.quantity;
  const costCents = snapshot?.unitCostCents;

  if (qty === null || qty === undefined || costCents === null || costCents === undefined) {
    return <td className="w-24 min-w-[96px] px-3 py-2 text-sm text-neutral-300">—</td>;
  }

  const totalCents = Math.round(qty * costCents);

  return (
    <td className="w-24 min-w-[96px] px-3 py-2 text-sm tabular-nums font-semibold text-neutral-600">
      {formatMoney(cents(totalCents))}
    </td>
  );
}
