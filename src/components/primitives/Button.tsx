import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-700 focus-visible:outline-brand-500',
  secondary:
    'bg-canvas-chrome border border-black/15 text-neutral-800 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-50 focus-visible:outline-brand-500',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-canvas-shell hover:text-brand-700 active:bg-canvas-shell focus-visible:outline-brand-500',
  danger:
    'bg-danger-500 text-white shadow-sm hover:bg-danger-600 active:bg-danger-600 focus-visible:outline-danger-500',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
