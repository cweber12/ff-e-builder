import type { ButtonHTMLAttributes } from 'react';

type GeneratedItemDragHandleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'type' | 'className'
> & {
  ariaLabel: string;
};

/**
 * Row reorder activator. Drag is a secondary action, so there is no visible
 * grip icon — the affordance is the grab cursor that appears over the leading
 * cell. The button itself stays in the DOM (visually empty but focusable) so
 * keyboard + screen-reader users can still reorder rows.
 */
export function GeneratedItemDragHandle({ ariaLabel, ...dragProps }: GeneratedItemDragHandleProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="block h-6 w-full cursor-grab rounded active:cursor-grabbing focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      {...dragProps}
    />
  );
}
