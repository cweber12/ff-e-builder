import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export function TableViewStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn('relative flex flex-1 flex-col overflow-auto', className)}>{children}</div>
  );
}

export function GroupedTableSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn('border-b border-neutral-200 bg-surface', className)}>
      {children}
    </section>
  );
}

export function GroupedTableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        'flex h-9 items-center justify-between gap-3 border-y border-neutral-200 bg-neutral-50 px-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StickyGrandTotal({
  label = 'Grand total',
  value,
}: {
  label?: string;
  value: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 rounded-lg border border-brand-500/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">{label}</span>
        <span className="text-lg font-bold tabular-nums text-brand-700">{value}</span>
      </div>
    </div>
  );
}
