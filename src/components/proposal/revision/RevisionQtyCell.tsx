import { useState, type MouseEvent } from 'react';
import { cn } from '../../../lib/utils';
import type { RevisionSnapshot } from '../../../types';

interface RevisionQtyCellProps {
  snapshot: RevisionSnapshot | undefined;
  currentQuantity: number;
  currentUnit: string;
  onSaveQuantity?: (value: number) => void;
  tdClassName?: string;
}

const inputClassName =
  'w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm tabular-nums text-gray-700 focus:border-brand-500 focus:outline-none';

export function RevisionQtyCell({
  snapshot,
  currentQuantity,
  currentUnit,
  onSaveQuantity,
  tdClassName,
}: RevisionQtyCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const qty = snapshot?.quantity;
  const canEdit = onSaveQuantity != null;

  const commit = (value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      onSaveQuantity!(parsed);
    }
    setEditing(false);
  };

  if (canEdit && editing) {
    return (
      <td
        className={cn(
          'w-44 min-w-[176px] border-l-2 border-l-brand-300 bg-amber-50 px-3 py-2',
          tdClassName,
        )}
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
          aria-label="Revised quantity"
        />
      </td>
    );
  }

  const handleClick = canEdit
    ? (e: MouseEvent) => {
        e.stopPropagation();
        setDraft(qty != null ? String(qty) : String(currentQuantity));
        setEditing(true);
      }
    : undefined;

  if (qty === null || qty === undefined) {
    return (
      <td
        className={cn(
          'w-44 min-w-[176px] border-l-2 border-l-brand-300 px-3 py-2 text-sm text-neutral-300',
          canEdit && 'cursor-pointer hover:bg-neutral-50',
          tdClassName,
        )}
        title={canEdit ? 'Click to set revised quantity' : undefined}
        onClick={handleClick}
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
        canEdit && 'cursor-pointer hover:bg-neutral-50',
        tdClassName,
      )}
      title={canEdit ? 'Click to update revised quantity' : undefined}
      onClick={handleClick}
    >
      {qty} {currentUnit}
    </td>
  );
}
