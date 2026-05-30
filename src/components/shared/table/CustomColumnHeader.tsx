import { useEffect, useRef, useState } from 'react';
import type { CustomColumnDef } from '../../../types';

type CustomColumnHeaderProps = {
  /** The custom column definition this header represents. */
  def: CustomColumnDef;
  /** Called when the user confirms the delete action. */
  onDelete: () => void;
  /** Called with the new label when the user renames the column. */
  onRename: (label: string) => Promise<void>;
};

/**
 * An inline-editable column header for user-defined custom columns.
 * Clicking the label enters rename mode; a hover-visible × button deletes
 * the column definition.
 *
 * Used by both the FF&E and Proposal tables inside their ColumnDef header
 * render functions.
 */
export function CustomColumnHeader({ def, onDelete, onRename }: CustomColumnHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(def.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== def.label) await onRename(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') {
            setDraft(def.label);
            setEditing(false);
          }
        }}
        maxLength={100}
        className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-700 focus:outline-none"
        aria-label={`Rename column ${def.label}`}
      />
    );
  }

  return (
    <span className="group flex items-center gap-1">
      <button
        type="button"
        title={`Rename column "${def.label}"`}
        onClick={() => setEditing(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1 text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {def.label}
      </button>
      <button
        type="button"
        title={`Delete column "${def.label}"`}
        aria-label={`Delete column "${def.label}"`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex shrink-0 rounded p-0.5 text-neutral-400 opacity-70 hover:bg-danger-50 hover:text-danger-600 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
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
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </span>
  );
}
