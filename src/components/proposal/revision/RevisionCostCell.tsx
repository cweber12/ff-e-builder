import { useState } from 'react';
import { cn } from '../../../lib/utils';
import { useUpdateRevisionItemCost } from '../../../hooks';
import { cents, dollarsToCents, formatMoney, parseUnitCostDollarsInput } from '../../../types';
import type { RevisionSnapshot } from '../../../types';

interface RevisionCostCellProps {
  snapshot: RevisionSnapshot | undefined;
  projectId: string;
  revisionId: string;
  itemId: string;
  tdClassName?: string;
}

const inputClassName =
  'w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:outline-none';

export function RevisionCostCell({
  snapshot,
  projectId,
  revisionId,
  itemId,
  tdClassName,
}: RevisionCostCellProps) {
  const updateCost = useUpdateRevisionItemCost(projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const costCents = snapshot?.unitCostCents ?? null;
  const costStatus = snapshot?.costStatus ?? 'none';
  const isFlagged = costStatus === 'flagged';
  const isResolved = costStatus === 'resolved';

  const commit = (value: string) => {
    const dollars = parseUnitCostDollarsInput(value);
    if (dollars !== undefined) {
      updateCost.mutate({ revisionId, itemId, unitCostCents: dollarsToCents(dollars) });
    }
    setEditing(false);
  };

  if (isFlagged && editing) {
    return (
      <td
        className={cn('w-32 min-w-[128px] bg-amber-50 px-3 py-2', tdClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className={inputClassName}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Escape') {
              setEditing(false);
            }
          }}
        />
      </td>
    );
  }

  // Non-flagged null: static dash
  if (!isFlagged && costCents === null) {
    return (
      <td className={cn('w-32 min-w-[128px] px-3 py-2 text-sm text-neutral-300', tdClassName)}>
        —
      </td>
    );
  }

  return (
    <td
      className={cn(
        'w-32 min-w-[128px] px-3 py-2 text-sm tabular-nums',
        isFlagged && 'cursor-pointer bg-amber-50 text-amber-700',
        isResolved && 'text-green-700',
        !isFlagged && !isResolved && 'text-neutral-500',
        tdClassName,
      )}
      title={isFlagged ? 'Click to set approved cost' : undefined}
      onClick={
        isFlagged
          ? (e) => {
              e.stopPropagation();
              setDraft(costCents !== null ? (costCents / 100).toFixed(2) : '');
              setEditing(true);
            }
          : undefined
      }
    >
      {costCents !== null ? formatMoney(cents(costCents)) : '—'}
      {isFlagged && (
        <span className="ml-1 text-xs text-amber-500" aria-label="Flagged for review">
          ⚑
        </span>
      )}
    </td>
  );
}
