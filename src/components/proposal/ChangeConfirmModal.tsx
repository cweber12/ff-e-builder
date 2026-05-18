import { useState } from 'react';
import { Button, Modal } from '../primitives';
import { proposalStatusConfig } from './proposalStatusConfig';
import { cn } from '../../lib/utils';
import type { ProposalStatus } from '../../types';

export interface ChangeConfirmResult {
  notes?: string;
  isPriceAffecting: boolean;
}

interface ChangeConfirmModalProps {
  columnLabel: string;
  previousValue: string;
  newValue: string;
  proposalStatus: ProposalStatus;
  /** When set, shows a revision badge instead of the status badge. */
  openRevisionLabel?: string | undefined;
  isPriceAffecting: boolean;
  lockPriceAffecting?: boolean;
  onConfirm: (result: ChangeConfirmResult) => void;
  onCancel: () => void;
}

export function ChangeConfirmModal({
  columnLabel,
  previousValue,
  newValue,
  proposalStatus,
  openRevisionLabel,
  isPriceAffecting,
  lockPriceAffecting = false,
  onConfirm,
  onCancel,
}: ChangeConfirmModalProps) {
  const [notes, setNotes] = useState('');
  const [priceAffecting, setPriceAffecting] = useState(isPriceAffecting);

  const cfg = proposalStatusConfig[proposalStatus];

  function handleConfirm() {
    const result: ChangeConfirmResult = { isPriceAffecting: priceAffecting };
    const trimmedNotes = notes.trim();
    if (trimmedNotes) result.notes = trimmedNotes;
    onConfirm(result);
  }

  return (
    <Modal open onClose={onCancel} title={`Change ${columnLabel}`}>
      <div className="space-y-4">
        {openRevisionLabel ? (
          <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium w-fit bg-brand-50 text-brand-700">
            Revision {openRevisionLabel}
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium w-fit',
              cfg.bgClass,
              cfg.textClass,
            )}
          >
            {cfg.label}
          </div>
        )}

        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="min-w-16 text-xs font-medium text-neutral-500">From</span>
            <span className="text-neutral-700 line-through">{previousValue || '—'}</span>
          </div>
          <div className="mt-1 flex items-start gap-2">
            <span className="min-w-16 text-xs font-medium text-neutral-500">To</span>
            <span className="font-medium text-neutral-900">{newValue || '—'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Notes <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <textarea
            className="input-base resize-none"
            rows={2}
            placeholder="Why is this changing?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="price-affecting-toggle"
            checked={priceAffecting}
            disabled={lockPriceAffecting}
            onChange={(e) => setPriceAffecting(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 accent-brand-600 cursor-pointer disabled:cursor-not-allowed"
          />
          <label
            htmlFor="price-affecting-toggle"
            className="text-sm text-neutral-700 cursor-pointer select-none"
          >
            Flag as price change
          </label>
        </div>

        {priceAffecting && (
          <div
            className={cn(
              'rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm text-amber-800',
            )}
          >
            <p className="font-medium">This change affects pricing.</p>
            <p className="mt-0.5 text-amber-700">
              {openRevisionLabel ? (
                <>
                  Saving will add this change to{' '}
                  <span className="font-semibold">Revision {openRevisionLabel}</span> and flag this
                  item's cost for review. You can update the quoted cost from the Revision panel.
                </>
              ) : (
                <>
                  Saving will open a <span className="font-semibold">Revision Round</span> and flag
                  this item's cost for review. You can update the quoted cost from the Revision
                  panel.
                </>
              )}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </div>
      </div>
    </Modal>
  );
}
