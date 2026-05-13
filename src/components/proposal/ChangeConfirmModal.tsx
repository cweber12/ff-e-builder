import { useState } from 'react';
import { Button, Modal } from '../primitives';
import { proposalStatusConfig } from './proposalStatusConfig';
import { cn } from '../../lib/utils';
import { parseUnitCostDollarsInput, dollarsToCents, formatMoney, cents } from '../../types';
import type { ProposalStatus } from '../../types';

export interface ChangeConfirmResult {
  notes?: string;
  newUnitCostCents?: number;
  deferCost?: boolean;
}

interface ChangeConfirmModalProps {
  columnLabel: string;
  previousValue: string;
  newValue: string;
  proposalStatus: ProposalStatus;
  isPriceAffecting: boolean;
  currentUnitCostCents: number;
  onConfirm: (result: ChangeConfirmResult) => void;
  onCancel: () => void;
}

type PriceAction = 'add' | 'defer' | 'skip';

export function ChangeConfirmModal({
  columnLabel,
  previousValue,
  newValue,
  proposalStatus,
  isPriceAffecting,
  currentUnitCostCents,
  onConfirm,
  onCancel,
}: ChangeConfirmModalProps) {
  const [notes, setNotes] = useState('');
  const [priceChecked, setPriceChecked] = useState(false);
  const [priceAction, setPriceAction] = useState<PriceAction>('skip');
  const [newCostInput, setNewCostInput] = useState((currentUnitCostCents / 100).toFixed(2));

  const cfg = proposalStatusConfig[proposalStatus];

  function handleConfirm() {
    const result: ChangeConfirmResult = {};
    const trimmedNotes = notes.trim();
    if (trimmedNotes) result.notes = trimmedNotes;
    if (isPriceAffecting && priceChecked) {
      if (priceAction === 'defer') {
        result.deferCost = true;
      } else if (priceAction === 'add') {
        const parsed = parseUnitCostDollarsInput(newCostInput);
        if (parsed !== undefined) result.newUnitCostCents = dollarsToCents(parsed);
      }
    }
    onConfirm(result);
  }

  const addCostInvalid =
    isPriceAffecting &&
    priceChecked &&
    priceAction === 'add' &&
    parseUnitCostDollarsInput(newCostInput) === undefined;

  return (
    <Modal open onClose={onCancel} title={`Change ${columnLabel}`}>
      <div className="space-y-4">
        <div
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium w-fit',
            cfg.bgClass,
            cfg.textClass,
          )}
        >
          {cfg.label}
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="min-w-16 text-xs font-medium text-gray-500">From</span>
            <span className="text-gray-700 line-through">{previousValue || '—'}</span>
          </div>
          <div className="mt-1 flex items-start gap-2">
            <span className="min-w-16 text-xs font-medium text-gray-500">To</span>
            <span className="font-medium text-gray-900">{newValue || '—'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
            rows={2}
            placeholder="Why is this changing?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {isPriceAffecting && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                checked={priceChecked}
                onChange={(e) => {
                  setPriceChecked(e.target.checked);
                  if (!e.target.checked) setPriceAction('skip');
                }}
              />
              <span className="text-sm font-medium text-gray-700">
                This change affects the price
              </span>
            </label>

            {priceChecked && (
              <div className="ml-6 space-y-2 rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800 mb-2">
                  Current unit cost: {formatMoney(cents(currentUnitCostCents))}
                </p>

                {(['add', 'defer', 'skip'] as PriceAction[]).map((action) => (
                  <label key={action} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priceAction"
                      className="mt-0.5 h-4 w-4 border-gray-300 text-brand-500 focus:ring-brand-400"
                      checked={priceAction === action}
                      onChange={() => setPriceAction(action)}
                    />
                    <span className="text-sm text-gray-700">
                      {action === 'add' && 'Add new cost'}
                      {action === 'defer' && 'Defer cost change'}
                      {action === 'skip' && 'No price change'}
                    </span>
                  </label>
                ))}

                {priceAction === 'add' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={cn(
                        'w-32 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400',
                        addCostInvalid ? 'border-danger-400' : 'border-gray-200',
                      )}
                      value={newCostInput}
                      onChange={(e) => setNewCostInput(e.target.value)}
                      placeholder="0.00"
                    />
                    {addCostInvalid && (
                      <span className="text-xs text-danger-600">Enter a valid amount</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={addCostInvalid}>
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
