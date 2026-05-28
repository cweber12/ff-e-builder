import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface LayoutSectionProps {
  id: string;
  label: string;
  defaultOpen: boolean;
  headerTrailingSlot?: ReactNode;
  children: ReactNode;
}

export function LayoutSection({
  id,
  label,
  defaultOpen,
  headerTrailingSlot,
  children,
}: LayoutSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    setIsOpen((current) => !current);
  };

  return (
    <section className="catalog-layout-group" data-state={isOpen ? 'open' : 'closed'}>
      <div className="flex items-start justify-between gap-3">
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
          <span className="catalog-layout-group-label text-brand-600">{label}</span>
        </button>
        {headerTrailingSlot ? (
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {headerTrailingSlot}
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
            isOpen ? 'border-l-2 border-brand-600 pl-3' : '',
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
