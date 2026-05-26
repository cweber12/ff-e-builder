import { Fragment, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { ProposalStatus } from '../../../types';
import { proposalStatuses } from '../../../types';
import { SegmentedControl } from '../../primitives';
import { PROPOSAL_STATUS_CONFIG } from './ProposalStatusDots';
import { ProposalStatusConfirmModal } from './ProposalStatusConfirmModal';

interface ProposalStatusSelectProps {
  status: ProposalStatus;
  onChange: (next: ProposalStatus) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  revisionGuard?: { openRevisionLabel: string; unresolvedCount: number };
}

const STAGE_TOOLTIPS: Record<ProposalStatus, string> = {
  in_progress: 'Free editing. No change records are created; revision rounds are not triggered.',
  pricing_complete:
    'Price-affecting edits (qty, size, CBM, unit cost) open a new revision round. Other edits are logged silently.',
  submitted:
    'Awaiting client review. Same edit semantics as Pricing Complete — price changes open a sub-revision.',
  approved:
    'Pricing is locked in. Further price changes start the next acceptance cycle as a new major revision.',
};

const STAGE_LABEL: Record<ProposalStatus, string> = {
  in_progress: 'In progress',
  pricing_complete: 'Pricing complete',
  submitted: 'Submitted',
  approved: 'Approved',
};

export function ProposalStatusSelect({
  status,
  onChange,
  disabled,
  className,
  revisionGuard,
}: ProposalStatusSelectProps) {
  const [pendingStatus, setPendingStatus] = useState<ProposalStatus | null>(null);
  const currentIndex = PROPOSAL_STATUS_CONFIG[status].stageIndex;
  const isAdvanceBlocked = revisionGuard != null && revisionGuard.unresolvedCount > 0;

  const handleStageClick = (next: ProposalStatus) => {
    if (disabled) return;
    if (next === status) return;
    setPendingStatus(next);
  };

  const handleConfirm = async () => {
    if (!pendingStatus) return;
    await onChange(pendingStatus);
    setPendingStatus(null);
  };

  return (
    <>
      <SegmentedControl
        ariaLabel="Proposal status"
        value={status}
        onChange={handleStageClick}
        variant="toolbar"
        tone="status"
        className={cn(
          'flex items-center gap-0',
          disabled && 'pointer-events-none opacity-60',
          className,
        )}
      >
        {proposalStatuses.map((stage, index) => {
          const stageIndex = PROPOSAL_STATUS_CONFIG[stage].stageIndex;
          const isCurrent = stageIndex === currentIndex;
          const isPast = stageIndex < currentIndex;
          const isFuture = stageIndex > currentIndex;
          const blocksHere = isAdvanceBlocked && stage !== 'in_progress' && isFuture;
          const isFirst = index === 0;

          return (
            <Fragment key={stage}>
              {!isFirst && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px w-4 sm:w-6',
                    isPast || isCurrent ? 'bg-brand-400' : 'bg-neutral-300',
                  )}
                />
              )}
              <SegmentedControl.Option
                value={stage}
                title={
                  blocksHere
                    ? `Cannot advance: ${revisionGuard?.unresolvedCount ?? 0} flagged item${revisionGuard?.unresolvedCount === 1 ? '' : 's'} in revision ${revisionGuard?.openRevisionLabel ?? ''}.`
                    : STAGE_TOOLTIPS[stage]
                }
                aria-label={`${STAGE_LABEL[stage]} — ${
                  blocksHere
                    ? `Cannot advance: ${revisionGuard?.unresolvedCount ?? 0} flagged item${revisionGuard?.unresolvedCount === 1 ? '' : 's'} in revision ${revisionGuard?.openRevisionLabel ?? ''}.`
                    : STAGE_TOOLTIPS[stage]
                }`}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group inline-flex h-8 items-center gap-1.5 uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                  isCurrent
                    ? 'text-brand-700 hover:bg-brand-50'
                    : isPast
                      ? 'text-neutral-600 hover:bg-neutral-100'
                      : blocksHere
                        ? 'cursor-not-allowed text-amber-600 hover:bg-amber-50'
                        : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600',
                )}
                onClick={(event) => {
                  if (blocksHere) {
                    event.preventDefault();
                  }
                }}
              >
                <StageMarker isCurrent={isCurrent} isPast={isPast} blocked={blocksHere} />
                <span className="hidden md:inline">{STAGE_LABEL[stage]}</span>
              </SegmentedControl.Option>
            </Fragment>
          );
        })}
      </SegmentedControl>

      {pendingStatus && (
        <ProposalStatusConfirmModal
          from={status}
          to={pendingStatus}
          {...(status === 'in_progress' && revisionGuard ? { revisionGuard } : {})}
          onConfirm={handleConfirm}
          onCancel={() => setPendingStatus(null)}
        />
      )}
    </>
  );
}

function StageMarker({
  isCurrent,
  isPast,
  blocked,
}: {
  isCurrent: boolean;
  isPast: boolean;
  blocked: boolean;
}) {
  if (blocked) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-500 bg-amber-100 text-[9px] font-bold text-amber-700"
      >
        !
      </span>
    );
  }
  if (isCurrent) {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-brand-500 bg-brand-100"
      />
    );
  }
  if (isPast) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 text-white"
      >
        <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
          <path
            d="m3 6 2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 rounded-full border border-neutral-300 bg-transparent"
    />
  );
}
