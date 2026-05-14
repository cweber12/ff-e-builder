import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Modal } from '../primitives';

export type BulkAction = 'duplicate' | 'move' | 'editField' | 'delete';

interface BulkActionBarProps {
  selectedCount: number;
  groupLabel?: string;
  onDuplicate?: () => void;
  onMove?: () => void;
  onEditField?: () => void;
  onDelete?: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  groupLabel = 'room',
  onDuplicate,
  onMove,
  onEditField,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const actions: { label: string; key: BulkAction; handler?: () => void; danger?: boolean }[] = [
    { label: 'Duplicate', key: 'duplicate', ...(onDuplicate ? { handler: onDuplicate } : {}) },
    { label: `Move to ${groupLabel}…`, key: 'move', ...(onMove ? { handler: onMove } : {}) },
    { label: 'Edit field…', key: 'editField', ...(onEditField ? { handler: onEditField } : {}) },
    { label: 'Delete', key: 'delete', handler: () => setConfirmDelete(true), danger: true },
  ];

  return (
    <>
      <div className="flex h-10 shrink-0 items-center border-t-2 border-brand-500/30 bg-surface pl-0 pr-4">
        {/* Brand accent strip */}
        <div className="h-full w-1 shrink-0 bg-brand-500" aria-hidden="true" />

        <span className="ml-3 text-sm font-medium text-neutral-900">{selectedCount} selected</span>

        <div className="ml-4 flex items-center">
          {actions.map((action, idx) => (
            <span key={action.key} className="flex items-center">
              {idx > 0 && (
                <span className="mx-2 text-neutral-300" aria-hidden="true">
                  ·
                </span>
              )}
              {action.handler ? (
                <button
                  type="button"
                  onClick={action.handler}
                  className={cn(
                    'text-sm hover:underline',
                    action.danger
                      ? 'text-danger-600 hover:text-danger-500'
                      : 'text-neutral-700 hover:text-neutral-900',
                  )}
                >
                  {action.label}
                </button>
              ) : (
                <span
                  title="Coming soon"
                  className={cn(
                    'cursor-not-allowed text-sm opacity-40',
                    action.danger ? 'text-danger-600' : 'text-neutral-700',
                  )}
                >
                  {action.label}
                </span>
              )}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onClear}
          className="ml-auto flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
          aria-label="Clear selection"
        >
          <span aria-hidden="true">✕</span> Clear
        </button>
      </div>

      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}?`}
        >
          <div className="space-y-4 px-1">
            <p className="text-sm text-neutral-600">
              This will permanently remove the selected{' '}
              {selectedCount === 1 ? 'item' : `${selectedCount} items`} and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-surface px-3 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete?.();
                }}
                className="inline-flex h-8 items-center rounded-md bg-danger-600 px-3 text-sm font-medium text-white hover:bg-danger-500"
              >
                Delete {selectedCount === 1 ? 'item' : `${selectedCount} items`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
