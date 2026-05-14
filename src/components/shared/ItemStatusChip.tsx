import { cn } from '../../lib/utils';
import type { ItemStatus } from '../../types';

const itemStatusConfig: Record<ItemStatus, { label: string; dotClass: string }> = {
  pending: { label: 'PENDING', dotClass: 'bg-neutral-400' },
  ordered: { label: 'ORDERED', dotClass: 'bg-brand-400' },
  approved: { label: 'APPROVED', dotClass: 'bg-brand-600' },
  received: { label: 'RECEIVED', dotClass: 'bg-success-500' },
};

interface ItemStatusChipProps {
  status: ItemStatus;
  className?: string;
}

export function ItemStatusChip({ status, className }: ItemStatusChipProps) {
  const cfg = itemStatusConfig[status];
  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label.toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-600',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dotClass)} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
