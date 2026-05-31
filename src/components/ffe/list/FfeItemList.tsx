import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal } from '../../primitives';
import { toast } from '../../primitives/toastApi';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { ItemStatusChip } from '../../shared/table/ItemStatusChip';
import type {
  FfeCatalogGroup,
  Item,
  ProposalCategoryWithItems,
  ProposalItem,
} from '../../../types';

function compareItemIdTags(a: Item, b: Item): number {
  const left = (a.itemIdTag ?? '').trim();
  const right = (b.itemIdTag ?? '').trim();
  if (!left && !right)
    return a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' });
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function proposalItemLabel(item: ProposalItem): string {
  return item.itemName.trim() || item.productTag.trim() || 'Untitled item';
}

function sortProposalItems(a: ProposalItem, b: ProposalItem): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return proposalItemLabel(a).localeCompare(proposalItemLabel(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

type FfeItemListProps = {
  projectId: string;
  groups: FfeCatalogGroup[];
  proposalCategoriesWithItems: ProposalCategoryWithItems[];
  onAddToFfeItems?: (proposalItemIds: string[]) => Promise<void>;
  onRemoveFromFfe?: (ffeItemId: string) => Promise<void>;
  isLoading?: boolean;
};

export function FfeItemList({
  projectId,
  groups,
  proposalCategoriesWithItems,
  onAddToFfeItems,
  onRemoveFromFfe,
  isLoading = false,
}: FfeItemListProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedProposalItemIds, setSelectedProposalItemIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  const addableCategories = useMemo(
    () =>
      [...proposalCategoriesWithItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((category) => ({
          ...category,
          items: [...category.items]
            .filter((item) => !item.linkedFfeItemId)
            .sort(sortProposalItems),
        }))
        .filter((category) => category.items.length > 0),
    [proposalCategoriesWithItems],
  );
  const addableCount = addableCategories.reduce((sum, category) => sum + category.items.length, 0);

  const toggleProposalItem = (proposalItemId: string) => {
    setSelectedProposalItemIds((current) => {
      const next = new Set(current);
      if (next.has(proposalItemId)) {
        next.delete(proposalItemId);
      } else {
        next.add(proposalItemId);
      }
      return next;
    });
  };

  const toggleCategory = (category: ProposalCategoryWithItems) => {
    const allSelected = category.items.every((item) => selectedProposalItemIds.has(item.id));
    setSelectedProposalItemIds((current) => {
      const next = new Set(current);
      category.items.forEach((item) => {
        if (allSelected) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  };

  const openAddModal = () => {
    setSelectedProposalItemIds(new Set());
    setAddModalOpen(true);
  };

  const confirmAddItems = async () => {
    if (!onAddToFfeItems || selectedProposalItemIds.size === 0) return;
    setIsAdding(true);
    try {
      const selectedIds = [...selectedProposalItemIds];
      await onAddToFfeItems(selectedIds);
      const label = selectedIds.length === 1 ? 'item' : 'items';
      toast.success(`Added ${selectedIds.length} ${label} to FF&E.`);
      setAddModalOpen(false);
      setSelectedProposalItemIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Add to FF&E failed: ${message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const removeFromFfe = async (item: Item) => {
    if (!onRemoveFromFfe) return;
    setRemovingItemId(item.id);
    try {
      await onRemoveFromFfe(item.id);
      toast.success(`${item.itemName} removed from FF&E.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Remove from FF&E failed: ${message}`);
    } finally {
      setRemovingItemId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="eyebrow">FF&amp;E List</h2>
          <button
            type="button"
            disabled
            className="text-link text-sm font-semibold text-brand-700/60"
          >
            Add +
          </button>
        </header>
        <div className="surface-paper">
          <div className="project-row flex items-center gap-4 px-4 py-4 text-sm text-neutral-500">
            Loading FF&amp;E items...
          </div>
        </div>
      </section>
    );
  }

  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasItems = sortedGroups.some((group) => group.items.length > 0);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="eyebrow">FF&amp;E List</h2>
        <button
          type="button"
          onClick={openAddModal}
          disabled={addableCount === 0 || isAdding || removingItemId !== null}
          className="text-link text-sm font-semibold text-brand-700 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:text-brand-700/50"
          aria-label="Add FF&E item"
        >
          Add +
        </button>
      </header>

      {!hasItems ? (
        <div className="surface-paper">
          <div className="project-row px-4 py-6 text-sm text-neutral-500">
            No FF&amp;E-visible items yet.
          </div>
        </div>
      ) : (
        sortedGroups
          .filter((group) => group.items.length > 0)
          .map((group) => {
            const sortedItems = [...group.items].sort(compareItemIdTags);
            return (
              <section key={group.id} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="eyebrow text-brand-600">{group.name}</h3>
                  <span className="num text-[11px] font-semibold text-neutral-500">
                    {group.items.length}
                  </span>
                </div>
                <div className="surface-paper">
                  {sortedItems.map((item, index) => (
                    <article
                      key={item.id}
                      className={[
                        'project-row flex items-center gap-4 px-4 py-3',
                        index > 0 ? 'border-t border-neutral-200' : '',
                        'hover:bg-canvas-shell',
                      ].join(' ')}
                    >
                      <Link
                        to={`/projects/${projectId}/ffe/catalog?item=${item.id}`}
                        className="flex min-w-0 flex-1 items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        aria-label={`Open catalog page for ${item.itemName}`}
                      >
                        <div className="flex-shrink-0 overflow-hidden">
                          <ImageFrame
                            entityType="item"
                            entityId={item.id}
                            alt={item.itemName}
                            className="h-16 w-16 object-cover"
                            compact
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="eyebrow text-neutral-500">
                            {item.itemIdTag || 'No ID tag'}
                          </p>
                          <h4 className="mt-0.5 truncate font-display text-lg font-semibold leading-snug text-neutral-950">
                            {item.itemName}
                          </h4>
                          <ItemStatusChip status={item.status} className="mt-1" />
                        </div>
                      </Link>

                      <button
                        type="button"
                        onClick={() => void removeFromFfe(item)}
                        disabled={!onRemoveFromFfe || removingItemId !== null}
                        className="text-link shrink-0 text-xs font-medium text-brand-700 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:text-brand-700/50"
                        aria-label={`Remove ${item.itemName} from FF&E`}
                      >
                        Remove from FF&amp;E
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            );
          })
      )}

      <Modal
        open={addModalOpen}
        onClose={() => {
          if (isAdding) return;
          setAddModalOpen(false);
        }}
        title="Add to FF&E"
        className="max-w-2xl"
      >
        {addableCategories.length === 0 ? (
          <p className="text-sm text-neutral-500">
            All proposal items are already visible in FF&amp;E.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">
              Select proposal items to add. Items already in FF&amp;E are hidden from this list.
            </p>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {addableCategories.map((category) => {
                const categoryAllSelected = category.items.every((item) =>
                  selectedProposalItemIds.has(item.id),
                );
                return (
                  <details key={category.id} open className="surface-paper p-3">
                    <summary className="flex cursor-pointer items-center justify-between gap-3">
                      <span className="eyebrow text-brand-600">{category.name}</span>
                      <span className="num text-xs font-semibold text-neutral-500">
                        {category.items.length}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        className="text-link text-xs font-medium text-brand-700"
                        onClick={() => toggleCategory(category)}
                      >
                        {categoryAllSelected ? 'Clear category' : 'Select category'}
                      </button>
                      {category.items.map((item) => {
                        const checked = selectedProposalItemIds.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-start gap-2 rounded border border-neutral-200 px-2.5 py-2 hover:bg-canvas-shell"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProposalItem(item.id)}
                              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-neutral-900">
                                {proposalItemLabel(item)}
                              </span>
                              {item.productTag && (
                                <span className="num text-[11px] text-neutral-500">
                                  {item.productTag}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void confirmAddItems()}
                disabled={!onAddToFfeItems || selectedProposalItemIds.size === 0 || isAdding}
              >
                {isAdding ? 'Adding…' : `Add selected (${selectedProposalItemIds.size})`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
