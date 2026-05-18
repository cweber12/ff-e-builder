import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '../../../lib/utils';

type TableScrollRef = RefObject<HTMLDivElement>;

const TableScrollContext = createContext<TableScrollRef | null>(null);

export function useTableScrollRef(): TableScrollRef | null {
  return useContext(TableScrollContext);
}

/**
 * Outer scroll container for FF&E and Proposal table views. Provides a shared
 * scroll ref via context so descendant section headers can drive horizontal
 * column navigation against the same viewport.
 */
export function TableViewStack({
  children,
  className,
  scrollRef: scrollRefProp,
}: {
  children: ReactNode;
  className?: string | undefined;
  scrollRef?: TableScrollRef | undefined;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollRefProp ?? internalRef;
  return (
    <TableScrollContext.Provider value={scrollRef}>
      <div
        ref={scrollRef}
        className={cn(
          'relative flex flex-1 flex-col overflow-auto bg-surface-muted scroll-smooth',
          className,
        )}
      >
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </TableScrollContext.Provider>
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
    <section
      className={cn(
        'relative w-fit min-w-full border border-neutral-300 bg-surface shadow-sm',
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * Sticky section header. Pins to the top of the outer table scroll container
 * so the active room/category title stays visible while scrolling through its
 * items. Inner content is sticky-left and sticky-right so controls remain
 * visible during horizontal column navigation.
 */
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
        // Strong dark band — anchors each room/category section and
        // contrasts sharply with the white card body below. Child controls
        // inside the section use light-on-dark variants set by the
        // surrounding callers.
        'sticky top-0 z-40 flex h-11 min-w-full items-center justify-between gap-3 border-b border-brand-900/40 bg-brand-700 px-4 text-white shadow-[0_1px_0_rgb(255_255_255_/_0.06)_inset]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className="mt-1 text-neutral-950">{children}</div>
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
    <div className="sticky bottom-0 z-10 rounded-md border border-brand-500/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-lg font-bold tabular-nums text-brand-700">{value}</span>
      </div>
    </div>
  );
}

function NavChevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d={direction === 'left' ? 'M12 5l-5 5 5 5' : 'M8 5l5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Compact horizontal navigation control for table column scrolling.
 * Drives the outer TableViewStack scroll ref (from context, or via prop) so
 * users can shift the column window one step at a time without using the
 * native horizontal scrollbar.
 */
export function ColumnNavArrows({
  scrollRef: scrollRefProp,
  stepPx = 200,
  className,
}: {
  scrollRef?: TableScrollRef | undefined;
  stepPx?: number;
  className?: string;
}) {
  const contextRef = useTableScrollRef();
  const scrollRef = scrollRefProp ?? contextRef;
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 1);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scrollRef]);

  if (!canLeft && !canRight) return null;

  const scroll = (dir: 1 | -1) => {
    const el = scrollRef?.current;
    if (!el) return;
    el.scrollBy({ left: dir * stepPx, behavior: 'smooth' });
  };

  const btn =
    'inline-flex h-7 w-7 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

  return (
    <div
      role="group"
      aria-label="Scroll table columns"
      className={cn(
        'inline-flex items-center overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => scroll(-1)}
        disabled={!canLeft}
        aria-label="Show previous columns"
        title="Show previous columns"
        className={btn}
      >
        <NavChevron direction="left" />
      </button>
      <span aria-hidden className="h-4 w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => scroll(1)}
        disabled={!canRight}
        aria-label="Show next columns"
        title="Show next columns"
        className={btn}
      >
        <NavChevron direction="right" />
      </button>
    </div>
  );
}
