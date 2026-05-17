import type { ButtonHTMLAttributes } from 'react';

type GeneratedItemDragHandleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'type' | 'className'
> & {
  ariaLabel: string;
};

export function GeneratedItemDragHandle({ ariaLabel, ...dragProps }: GeneratedItemDragHandleProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="cursor-grab rounded px-1 text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      {...dragProps}
    >
      <GripIcon />
    </button>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="7" cy="5" r="1.2" />
      <circle cx="13" cy="5" r="1.2" />
      <circle cx="7" cy="10" r="1.2" />
      <circle cx="13" cy="10" r="1.2" />
      <circle cx="7" cy="15" r="1.2" />
      <circle cx="13" cy="15" r="1.2" />
    </svg>
  );
}
