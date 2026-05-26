import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'neutral' | 'brand' | 'danger' | 'warning' | 'success';
export type BadgeSize = 'sm' | 'md';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  uppercase?: boolean;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-black/10',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/50',
  danger: 'bg-danger-500/10 text-danger-600',
  warning: 'bg-amber-100 text-amber-800',
  success: 'bg-emerald-100 text-emerald-800',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] font-semibold',
  md: 'px-2 py-0.5 text-xs font-medium',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  uppercase = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill',
        variantClasses[variant],
        sizeClasses[size],
        uppercase && 'uppercase tracking-wide',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
