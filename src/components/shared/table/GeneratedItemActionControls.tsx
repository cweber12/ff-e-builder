import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

type GeneratedItemActionTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'inline' | 'icon';
};

export const GeneratedItemActionTrigger = forwardRef<
  HTMLButtonElement,
  GeneratedItemActionTriggerProps
>(function GeneratedItemActionTrigger({ variant = 'icon', className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        variant === 'icon'
          ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500'
          : 'rounded px-2 py-1 text-neutral-400 hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
        className,
      )}
      {...props}
    >
      {children ?? <MoreIcon />}
    </button>
  );
});

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}
