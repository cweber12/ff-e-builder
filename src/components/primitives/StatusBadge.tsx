import type { ItemStatus } from '../../types';
import { cn } from '../../lib/utils';

type StatusIconName = 'clock' | 'check' | 'truck' | 'box';

const statusConfig: Record<
  ItemStatus,
  { label: string; icon: StatusIconName; bgClass: string; textClass: string }
> = {
  pending: {
    label: 'Pending',
    icon: 'clock',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  approved: {
    label: 'Approved',
    icon: 'check',
    bgClass: 'bg-brand-50',
    textClass: 'text-brand-700',
  },
  ordered: {
    label: 'Ordered',
    icon: 'truck',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  received: {
    label: 'Received',
    icon: 'box',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
};

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

function StatusIcon({ icon }: { icon: StatusIconName }) {
  if (icon === 'clock') {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.8V8l2.2 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'truck') {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M2.5 5h7v5h-7V5Zm7 2h2l2 2v1h-4V7Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="5" cy="11" r="1.1" fill="currentColor" />
        <circle cx="11.5" cy="11" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (icon === 'box') {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M3 5.5 8 3l5 2.5v5L8 13l-5-2.5v-5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M3.3 5.7 8 8.1l4.7-2.4M8 8.1V13"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="m3.5 8.2 3 3L12.8 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium',
        cfg.bgClass,
        cfg.textClass,
        className,
      )}
    >
      <StatusIcon icon={cfg.icon} />
      {cfg.label}
    </span>
  );
}
