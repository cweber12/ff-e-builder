import { cn } from '../../../lib/utils';
import type { ProposalStatus } from '../../../types';
import { Modal } from '../../primitives';
import { ProposalStatusDots, PROPOSAL_STATUS_CONFIG } from './ProposalStatusDots';

const TRACKED_STATUSES: ProposalStatus[] = ['pricing_complete', 'submitted', 'approved'];

function getModalCopy(from: ProposalStatus, to: ProposalStatus) {
  const toCfg = PROPOSAL_STATUS_CONFIG[to];
  const label = toCfg.label.charAt(0) + toCfg.label.slice(1).toLowerCase().replace(/_/g, ' ');

  // Title: use destination verb
  const isBackward = TRACKED_STATUSES.indexOf(to) < TRACKED_STATUSES.indexOf(from);
  const title = isBackward ? `Move proposal back to ${label}?` : `Mark proposal as ${label}?`;

  // CTA: repeat destination
  const cta = isBackward ? `Move to ${label}` : `Mark as ${label}`;

  // Body paragraph
  let bodyText: string | null = null;
  const fromIsUntracked = from === 'in_progress';
  const toIsUntracked = to === 'in_progress';

  if (!fromIsUntracked && toIsUntracked) {
    bodyText = 'Item change records will no longer be created from edits.';
  } else if (fromIsUntracked && !toIsUntracked) {
    bodyText =
      'Future edits to product tag, size, quantity, and unit cost will create item change records.';
  }

  return { title, cta, bodyText, isBackward };
}

interface ProposalStatusConfirmModalProps {
  from: ProposalStatus;
  to: ProposalStatus;
  revisionGuard?: { openRevisionLabel: string; unresolvedCount: number };
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ProposalStatusConfirmModal({
  from,
  to,
  revisionGuard,
  onConfirm,
  onCancel,
}: ProposalStatusConfirmModalProps) {
  const { title, cta, bodyText, isBackward } = getModalCopy(from, to);
  const fromCfg = PROPOSAL_STATUS_CONFIG[from];
  const toCfg = PROPOSAL_STATUS_CONFIG[to];

  const isRevisionClose = from === 'in_progress' && revisionGuard != null;
  const isBlocked = isRevisionClose && revisionGuard.unresolvedCount > 0;

  return (
    <Modal open onClose={onCancel} title={title}>
      <div className="space-y-4 px-1">
        {/* Current → Destination dots display */}
        <div className="flex flex-col gap-2.5 rounded-md bg-neutral-50 p-3">
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs text-neutral-500">Currently</span>
            <ProposalStatusDots status={from} />
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-600">
              {fromCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs text-neutral-500">Becomes</span>
            <ProposalStatusDots status={to} />
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-600">
              {toCfg.label}
            </span>
          </div>
        </div>

        {bodyText && <p className="text-sm text-neutral-600">{bodyText}</p>}

        {isRevisionClose && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600">
              This will close Revision {revisionGuard.openRevisionLabel}.
            </p>
            {isBlocked && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <span aria-hidden="true">⚠</span>
                <span>
                  {revisionGuard.unresolvedCount === 1
                    ? '1 item still has'
                    : `${revisionGuard.unresolvedCount} items still have`}{' '}
                  an unresolved cost — enter a unit cost before advancing status.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-surface px-3 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isBlocked}
            className={cn(
              'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium',
              isBlocked
                ? 'cursor-not-allowed bg-neutral-200 text-neutral-400'
                : isBackward
                  ? 'border border-warning-500/40 text-warning-500 hover:bg-warning-500/5'
                  : 'bg-brand-500 text-white hover:bg-brand-600',
            )}
          >
            {cta}
          </button>
        </div>
      </div>
    </Modal>
  );
}
