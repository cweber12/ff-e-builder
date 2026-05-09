import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

type ColumnManagerPopoverProps = {
  /** Labels for default columns that have been hidden, keyed by column ID. */
  hiddenDefaults: { id: string; label: string }[];
  /** Whether the table supports custom columns (Phase 1: true for FF&E, false for Proposal). */
  allowCustomColumns?: boolean;
  /** Called when the user clicks a hidden default column to restore it. */
  onRestoreDefault: (columnId: string) => void;
  /** Called when the user submits a new custom column label. */
  onAddCustomColumn?: (label: string) => Promise<void> | void;
};

/**
 * A "+" button that opens a panel for:
 *   - Restoring hidden default columns
 *   - Adding a new custom column (when `allowCustomColumns` is true)
 *
 * Rendered in the column header row, after the last column header.
 */
export function ColumnManagerPopover({
  hiddenDefaults,
  allowCustomColumns = false,
  onRestoreDefault,
  onAddCustomColumn,
}: ColumnManagerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus input when popover opens
  useEffect(() => {
    if (open && allowCustomColumns) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, allowCustomColumns]);

  const hasContent = hiddenDefaults.length > 0 || allowCustomColumns;

  if (!hasContent) return null;

  const handleAddCustom = async () => {
    const label = newLabel.trim();
    if (!label || !onAddCustomColumn) return;
    setAdding(true);
    try {
      await onAddCustomColumn(label);
      setNewLabel('');
      setOpen(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        aria-label="Manage columns"
        aria-expanded={open}
        title="Add or restore columns"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded text-gray-400',
          'hover:bg-brand-50 hover:text-brand-600',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
          open && 'bg-brand-50 text-brand-600',
        )}
      >
        <PlusIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Column manager"
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
        >
          {hiddenDefaults.length > 0 && (
            <section className="mb-2">
              <p className="mb-1 px-1 text-xs font-medium text-gray-500">Restore column</p>
              {hiddenDefaults.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onRestoreDefault(id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <span className="text-gray-400">
                    <RestoreIcon />
                  </span>
                  {label}
                </button>
              ))}
            </section>
          )}

          {allowCustomColumns && (
            <>
              {hiddenDefaults.length > 0 && <hr className="mb-2 border-gray-100" />}
              <section>
                <p className="mb-1 px-1 text-xs font-medium text-gray-500">Add custom column</p>
                <div className="flex gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAddCustom();
                      if (e.key === 'Escape') setOpen(false);
                    }}
                    placeholder="Column name"
                    maxLength={100}
                    aria-label="New column name"
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!newLabel.trim() || adding}
                    onClick={() => void handleAddCustom()}
                    className="rounded bg-brand-500 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    {adding ? '…' : 'Add'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3" />
    </svg>
  );
}
