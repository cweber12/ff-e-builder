import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface LayoutSectionProps {
  id: string;
  label: string;
  defaultOpen: boolean;
  /** Optional content rendered in the header row, to the right of the label. Clicks inside do not toggle the section. */
  headerTrailing?: ReactNode;
  children: ReactNode;
  /** Controlled open state. When provided, overrides internal state. */
  open?: boolean;
  /** Called when the header is toggled. Required when `open` is provided. */
  onToggle?: () => void;
}

export function LayoutSection({
  id,
  label,
  defaultOpen,
  headerTrailing,
  children,
  open: controlledOpen,
  onToggle,
}: LayoutSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const toggleOpen = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((current) => !current);
    }
  };

  return (
    <section className="catalog-layout-group" data-state={isOpen ? 'open' : 'closed'}>
      <div
        className={cn(
          'flex items-start justify-between gap-3 pb-2',
          isOpen ? 'border-b border-black/8' : '',
        )}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`${id}-body`}
          className="flex-1 text-left"
          onClick={toggleOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleOpen();
            }
          }}
        >
          <span className="catalog-layout-group-label">{label}</span>
        </button>
        {headerTrailing ? (
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {headerTrailing}
          </div>
        ) : null}
      </div>
      <div
        id={`${id}-body`}
        data-state={isOpen ? 'open' : 'closed'}
        className={cn(
          'overflow-hidden transition-[max-height] duration-200 ease-out',
          isOpen ? 'max-h-[1200px]' : 'max-h-0',
        )}
      >
        <div
          className={cn(
            'catalog-layout-group-body mt-1.5',
            isOpen ? 'border-l-2 border-brand-500 pl-3' : '',
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
