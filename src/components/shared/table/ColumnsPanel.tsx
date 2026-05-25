import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../../lib/utils';
import { useActionsMenu } from '../../../hooks';
import type { CustomColumnDef } from '../../../types';

type VisibleColumnItem = {
  id: string;
  label: string;
  isCustom?: boolean;
};

type ColumnsPanelProps = {
  title: string;
  visibleColumns: VisibleColumnItem[];
  hiddenDefaults: { id: string; label: string }[];
  customColumns: CustomColumnDef[];
  onMoveColumn: (fromId: string, toId: string) => void;
  onHideColumn: (id: string) => void;
  onRestoreDefault: (id: string) => void;
  onRenameCustomColumn: (id: string, label: string) => Promise<void>;
  onDeleteCustomColumn: (id: string) => void;
  onOpenAddColumnModal: () => void;
  triggerClassName?: string;
};

export function ColumnsPanel({
  title,
  visibleColumns,
  hiddenDefaults,
  customColumns,
  onMoveColumn,
  onHideColumn,
  onRestoreDefault,
  onRenameCustomColumn,
  onDeleteCustomColumn,
  onOpenAddColumnModal,
  triggerClassName,
}: ColumnsPanelProps) {
  const actionsMenu = useActionsMenu();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const panelPosition = actionsMenu.getPortalPosition(actionsMenu.triggerRef, {
    edge: 'right',
    offsetY: 6,
  });

  const customColumnMap = useMemo(
    () => new Map(customColumns.map((column) => [column.id, column])),
    [customColumns],
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over) return;
      const fromId = String(active.id);
      const toId = String(over.id);
      if (fromId === toId) return;
      onMoveColumn(fromId, toId);
    },
    [onMoveColumn],
  );

  return (
    <div className="inline-flex">
      <button
        ref={actionsMenu.triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={actionsMenu.open}
        aria-label={`Open columns panel for ${title}`}
        title={`Open columns panel for ${title}`}
        onClick={actionsMenu.toggleMenu}
        className={cn(
          'inline-flex items-center gap-1 rounded-pill border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-brand-50 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80',
          triggerClassName,
        )}
      >
        <DragDotsIcon className="h-3.5 w-3.5" />
        Columns
      </button>
      {actionsMenu.open &&
        panelPosition &&
        createPortal(
          <div
            ref={actionsMenu.panelRef}
            role="dialog"
            aria-label={`${title} columns panel`}
            style={panelPosition}
            className="z-[180] w-[22rem] rounded-sm border border-black/10 bg-canvas-chrome p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                Columns
              </h3>
              <button
                type="button"
                onClick={actionsMenu.closeMenu}
                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                aria-label="Close columns panel"
              >
                ×
              </button>
            </div>

            <p className="mb-2 text-[11px] text-neutral-500">Visible (drag to reorder)</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleColumns.map((column) => column.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-black/10 bg-white p-1">
                  {visibleColumns.map((column) => (
                    <ColumnsPanelVisibleRow
                      key={column.id}
                      item={column}
                      onHide={() => onHideColumn(column.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="mt-3">
              <p className="mb-1 text-[11px] text-neutral-500">Hidden defaults</p>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-black/10 bg-white p-1">
                {hiddenDefaults.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-neutral-400">No hidden default columns</p>
                ) : (
                  hiddenDefaults.map((column) => (
                    <button
                      key={column.id}
                      type="button"
                      onClick={() => onRestoreDefault(column.id)}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-neutral-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                    >
                      <span className="truncate">{column.label}</span>
                      <span className="text-[10px] text-neutral-400">Restore</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] text-neutral-500">Custom columns</p>
                <button
                  type="button"
                  onClick={() => {
                    actionsMenu.closeMenu();
                    onOpenAddColumnModal();
                  }}
                  className="rounded border border-black/10 px-1.5 py-0.5 text-[11px] text-neutral-600 hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  Add
                </button>
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-black/10 bg-white p-1">
                {customColumns.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-neutral-400">No custom columns</p>
                ) : (
                  customColumns.map((column) => (
                    <CustomColumnCrudRow
                      key={column.id}
                      column={customColumnMap.get(column.id) ?? column}
                      onRename={onRenameCustomColumn}
                      onDelete={onDeleteCustomColumn}
                    />
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ColumnsPanelVisibleRow({ item, onHide }: { item: VisibleColumnItem; onHide: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded border border-transparent px-1 py-1 hover:border-black/10 hover:bg-neutral-50"
    >
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Reorder ${item.label} column`}
        title={`Reorder ${item.label} column`}
        {...attributes}
        {...listeners}
      >
        <DragDotsIcon className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">{item.label}</span>
      <button
        type="button"
        aria-label={`Hide ${item.label} column`}
        title={`Hide ${item.label} column`}
        onClick={onHide}
        className="rounded p-0.5 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        ×
      </button>
    </div>
  );
}

function CustomColumnCrudRow({
  column,
  onRename,
  onDelete,
}: {
  column: CustomColumnDef;
  onRename: (id: string, label: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(column.label);
      setEditing(false);
      return;
    }
    if (trimmed !== column.label) {
      await onRename(column.id, trimmed);
    }
    setEditing(false);
  }, [column.id, column.label, draft, onRename]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(column.label);
            setEditing(false);
          }
        }}
        autoFocus
        maxLength={100}
        className="w-full rounded border border-brand-400 bg-white px-2 py-1 text-xs text-neutral-700 focus:outline-none"
        aria-label={`Rename custom column ${column.label}`}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-50">
      <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">{column.label}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded border border-black/10 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Rename custom column ${column.label}`}
      >
        Rename
      </button>
      <button
        type="button"
        onClick={() => onDelete(column.id)}
        className="rounded border border-danger-200 px-1.5 py-0.5 text-[10px] text-danger-600 hover:bg-danger-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={`Delete custom column ${column.label}`}
      >
        Delete
      </button>
    </div>
  );
}

function DragDotsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="3" cy="3" r="1" />
      <circle cx="9" cy="3" r="1" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="9" cy="6" r="1" />
      <circle cx="3" cy="9" r="1" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  );
}
