import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';
import type { ProposalStatus } from '../../../types';
import { proposalStatuses } from '../../../types';
import { ProposalStatusDots, PROPOSAL_STATUS_CONFIG } from './ProposalStatusDots';
import { ProposalStatusConfirmModal } from './ProposalStatusConfirmModal';

interface ProposalStatusSelectProps {
  status: ProposalStatus;
  onChange: (next: ProposalStatus) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function ProposalStatusSelect({
  status,
  onChange,
  disabled,
  className,
}: ProposalStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProposalStatus | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cfg = PROPOSAL_STATUS_CONFIG[status];

  function handleOptionClick(next: ProposalStatus) {
    if (next === status) {
      setOpen(false);
      return;
    }
    setPendingStatus(next);
    setOpen(false);
  }

  async function handleConfirm() {
    if (!pendingStatus) return;
    await onChange(pendingStatus);
    setPendingStatus(null);
  }

  function handleCancelConfirm() {
    setPendingStatus(null);
  }

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <>
      <div className={className}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Proposal status: ${cfg.label}`}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-surface px-2.5 text-xs hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ProposalStatusDots status={status} />
          <span className="font-medium uppercase tracking-[0.08em] text-neutral-700">
            {cfg.label}
          </span>
          <ChevronDownIcon />
        </button>

        {open &&
          triggerRect &&
          createPortal(
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[99]"
                aria-hidden="true"
                onClick={() => setOpen(false)}
              />
              {/* Dropdown */}
              <div
                role="listbox"
                aria-label="Select proposal status"
                style={{
                  position: 'fixed',
                  top: triggerRect.bottom + 4,
                  left: triggerRect.left,
                }}
                className="z-[100] w-56 overflow-hidden rounded-md border border-neutral-200 bg-surface shadow-md"
              >
                {proposalStatuses.map((s) => {
                  const sCfg = PROPOSAL_STATUS_CONFIG[s];
                  const isActive = s === status;
                  return (
                    <button
                      key={s}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => handleOptionClick(s)}
                      className={cn(
                        'relative flex h-9 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-neutral-50',
                        isActive && 'bg-neutral-50',
                      )}
                    >
                      {isActive && (
                        <span
                          className="absolute inset-y-0 left-0 w-1 rounded-r-sm bg-brand-500"
                          aria-hidden="true"
                        />
                      )}
                      <ProposalStatusDots status={s} />
                      <span className="text-neutral-700">
                        {sCfg.label.charAt(0) +
                          sCfg.label.slice(1).toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )}
      </div>

      {pendingStatus && (
        <ProposalStatusConfirmModal
          from={status}
          to={pendingStatus}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 text-neutral-400" aria-hidden="true">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
