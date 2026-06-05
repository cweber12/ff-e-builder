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
  neutral: 'bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300/70',
  brand: 'bg-neutral-100 text-brand-700 ring-1 ring-inset ring-neutral-300/70',
  danger: 'bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/20',
  warning: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-500/25',
  success: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/20',
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
