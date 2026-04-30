import type { ItemStatus } from '../../types';
import { cn } from '../../lib/cn';

const statusConfig: Record<
  ItemStatus,
  { label: string; icon: string; bgClass: string; textClass: string }
> = {
  pending: {
    label: 'Pending',
    icon: '⏳',
    bgClass: 'bg-amber-50',
    textClass: 'text-warning-500',
  },
  approved: {
    label: 'Approved',
    icon: '✓',
    bgClass: 'bg-brand-50',
    textClass: 'text-brand-500',
  },
  ordered: {
    label: 'Ordered',
    icon: '📦',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-600',
  },
  received: {
    label: 'Received',
    icon: '✓',
    bgClass: 'bg-emerald-50',
    textClass: 'text-success-500',
  },
};

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium',
        cfg.bgClass,
        cfg.textClass,
        className,
      )}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
