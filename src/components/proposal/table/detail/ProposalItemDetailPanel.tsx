import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '../../../../lib/utils';
import {
  useAddProposalItemToFfe,
  useCreateProposalItem,
  useDeleteProposalItem,
  useIsMobileViewport,
  useProposalRevisions,
  useRevisionChangelog,
  useProposalWithItems,
  useUpdateProposalItem,
} from '../../../../hooks';
import { proposalLineTotalCents } from '../../../../lib/money';
import type { ProposalItemChangelogEntry } from '../../../../types';
import { MaterialLibraryModal } from '../../../materials';
import { Button, Modal } from '../../../primitives';
import { toast } from '../../../primitives/toastApi';
import type { UpdateProposalItemInput } from '../../../../lib/api';
import { ProposalItemDetailMediaStrip } from './ProposalItemDetailMediaStrip';
import { ProposalItemDetailForm } from './ProposalItemDetailForm';
import { ProposalItemDetailChangelog } from './ProposalItemDetailChangelog';
import {
  buildProposalItemDuplicateInput,
  proposalItemDisplayName,
  proposalItemLocationName,
} from '../proposalTableItemHelpers';

type Props = {
  itemId: string;
  categoryId: string;
  projectId: string;
  onClose: () => void;
  onSelectItemId: (itemId: string) => void;
};

export function ProposalItemDetailPanel({
  itemId,
  categoryId,
  projectId,
  onClose,
  onSelectItemId,
}: Props) {
  const { categoriesWithItems } = useProposalWithItems(projectId, new Set());
  const { data: revisions = [] } = useProposalRevisions(projectId);
  const { data: changelogAll = [] } = useRevisionChangelog(projectId);
  const isMobile = useIsMobileViewport();
  const updateItem = useUpdateProposalItem();
  const createItem = useCreateProposalItem(categoryId);
  const deleteItem = useDeleteProposalItem(categoryId);
  const addToFfe = useAddProposalItemToFfe(projectId);

  const openRev = useMemo(() => revisions.find((r) => r.closedAt === null) ?? null, [revisions]);
  const itemChangelog = useMemo<ProposalItemChangelogEntry[]>(() => {
    if (!openRev) return [];
    return changelogAll
      .filter((entry) => entry.revisionId === openRev.id && entry.proposalItemId === itemId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }, [changelogAll, openRev, itemId]);

  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const category = useMemo(
    () => categoriesWithItems.find((c) => c.id === categoryId),
    [categoriesWithItems, categoryId],
  );
  const sortedItems = useMemo(
    () => (category ? [...category.items].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [category],
  );
  const currentIndex = sortedItems.findIndex((i) => i.id === itemId);
  const item = currentIndex >= 0 ? sortedItems[currentIndex] : undefined;

  // Close if the item disappears (deleted, moved out of category, etc.).
  useEffect(() => {
    if (category && currentIndex < 0) onClose();
  }, [category, currentIndex, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!item || !category) return null;

  const lineTotal = proposalLineTotalCents(item);

  const save = (patch: Omit<UpdateProposalItemInput, 'version'>) => {
    updateItem.mutate({
      id: item.id,
      patch: { ...patch, version: item.version },
      projectId,
    });
  };

  const handleDuplicate = () => {
    createItem.mutate(buildProposalItemDuplicateInput(item));
  };

  const handleAddToFfe = () => {
    const displayName = proposalItemDisplayName(item);
    const locationName = proposalItemLocationName(item);
    addToFfe.mutate(item.id, {
      onSuccess: () => {
        toast.success(`${displayName} added to FF&E location ${locationName}.`);
      },
    });
  };

  const handleDelete = () => {
    deleteItem.mutate(item.id);
    onClose();
  };

  const itemDisplayName = proposalItemDisplayName(item, 'item');

  const goPrev = () => {
    if (sortedItems.length < 2) return;
    const prevIndex = (currentIndex - 1 + sortedItems.length) % sortedItems.length;
    const next = sortedItems[prevIndex];
    if (next) onSelectItemId(next.id);
  };
  const goNext = () => {
    if (sortedItems.length < 2) return;
    const nextIndex = (currentIndex + 1) % sortedItems.length;
    const next = sortedItems[nextIndex];
    if (next) onSelectItemId(next.id);
  };

  return (
    <aside
      role="dialog"
      aria-label={`Item details for ${item.productTag || 'item'}`}
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden bg-canvas-chrome shadow-2xl',
        isMobile
          ? 'inset-0'
          : 'inset-y-0 right-0 w-[clamp(420px,45vw,720px)] border-l border-neutral-200',
      )}
    >
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-neutral-200 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{category.name}</p>
          <h2 className="mt-0.5 truncate font-display text-base font-semibold text-neutral-950">
            {item.productTag || 'Unnamed item'}
          </h2>
        </div>
        <PrevNextButtons
          disabled={sortedItems.length < 2}
          position={`${currentIndex + 1} of ${sortedItems.length}`}
          onPrev={goPrev}
          onNext={goNext}
        />
        <PanelActionsMenu
          itemName={itemDisplayName}
          onDuplicate={handleDuplicate}
          onAddToFfe={handleAddToFfe}
          onDelete={() => setDeleteOpen(true)}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="icon-btn"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
        <ProposalItemDetailMediaStrip itemId={item.id} itemProductTag={item.productTag} />

        <div className="flex-1 p-6">
          <ProposalItemDetailForm
            item={item}
            lineTotalCents={lineTotal}
            onSave={save}
            onOpenMaterials={() => setMaterialsOpen(true)}
          />

          {openRev && (
            <ProposalItemDetailChangelog
              revisionLabel={openRev.label}
              entries={itemChangelog}
              projectId={projectId}
            />
          )}
        </div>
      </div>

      <MaterialLibraryModal
        open={materialsOpen}
        projectId={projectId}
        context="proposal"
        categoryId={categoryId}
        item={item}
        onClose={() => setMaterialsOpen(false)}
      />

      <DeleteItemConfirm
        open={deleteOpen}
        itemName={itemDisplayName}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </aside>
  );
}

function DeleteItemConfirm({
  open,
  itemName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${itemName}?`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          This will permanently remove <strong>{itemName}</strong> from the proposal. This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Delete item
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PanelActionsMenu({
  itemName,
  onDuplicate,
  onAddToFfe,
  onDelete,
}: {
  itemName: string;
  onDuplicate: () => void;
  onAddToFfe: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const run = (action: () => void) => (event: ReactMouseEvent) => {
    event.stopPropagation();
    setOpen(false);
    action();
  };

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open actions for ${itemName}`}
        onClick={() => setOpen((v) => !v)}
        className="icon-btn"
      >
        <MoreIcon />
      </button>
      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              right: window.innerWidth - triggerRect.right,
            }}
            className="z-[100] min-w-48 menu-panel"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
              onClick={run(onDuplicate)}
            >
              Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
              onClick={run(onAddToFfe)}
            >
              Add to FF&amp;E
            </button>
            <div className="my-1 h-px bg-neutral-100" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-danger-600 hover:bg-brand-50"
              onClick={run(onDelete)}
            >
              Delete item
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}

function PrevNextButtons({
  disabled,
  position,
  onPrev,
  onNext,
}: {
  disabled: boolean;
  position: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-1 mr-1 text-neutral-500">
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label="Previous item"
        className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronIcon direction="left" />
      </button>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] tabular-nums">
        {position}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label="Next item"
        className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn('h-4 w-4', direction === 'right' && 'rotate-180')}
    >
      <path
        d="M12 5l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
