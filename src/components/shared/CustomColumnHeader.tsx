import { useEffect, useRef, useState } from 'react';
import type { CustomColumnDef } from '../../types';

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
        className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-700 focus:outline-none"
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
        className="hidden rounded p-0.5 text-gray-400 hover:bg-danger-50 hover:text-danger-600 group-hover:flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  );
}
