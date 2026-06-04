import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { toast } from '../../../primitives/toastApi';
import {
  type CustomColumnDef,
  type ProposalItem,
  type ProposalStatus,
  type RevisionSnapshot,
} from '../../../../types';
import {
  useAddProposalCategoryToFfe,
  useAddProposalItemToFfe,
  useCreateProposalItem,
  useDeleteProposalItem,
  useFinishes,
  useIsMobileViewport,
  useMaterialCellPaste,
  useMoveProposalItem,
  useProposalRevisions,
  useRecentMaterials,
  useReorderProposalItems,
  useRevisionSnapshots,
} from '../../../../hooks';
import type { UpdateProposalItemInput } from '../../../../lib/api';
import { GroupedTableSection } from '../../../shared/table/TableViewWrappers';
import { ProposalRecordRow } from '../row';
import { ProposalCategoryHeader } from './ProposalCategoryHeader';
import { ProposalCategoryMobileCards } from './ProposalCategoryMobileCards';
import { ProposalCategoryExpandedTable } from './ProposalCategoryExpandedTable';
import { AddColumnModal } from '../../../shared/modals/AddColumnModal';
import {
  ChangeConfirmModal,
  type ChangeConfirmResult,
} from '../../../shared/modals/ChangeConfirmModal';
import {
  buildProposalCategoryConfirmedSave,
  prepareProposalCategoryItemSave,
  type PendingProposalCategoryChange,
} from './proposalTrackedEditFlow';
import {
  PROPOSAL_COLUMN_META,
  type ProposalColumnId,
  STICKY_RIGHT_COLUMN_IDS,
} from '../proposalTableConstants';
import {
  buildProposalItemDuplicateInput,
  proposalItemDisplayName,
} from '../proposalTableItemHelpers';

const MaterialLibraryModal = lazy(() =>
  import('../../../materials').then((module) => ({ default: module.MaterialLibraryModal })),
);

type ProposalCategorySectionProps = {
  projectId: string;
  categoryId: string;
  categoryName: string;
  items: ProposalItem[];
  otherCategories: { id: string; name: string }[];
  subtotalCents: number;
  collapsed: boolean;
  onToggle: () => void;
  onCategoryNameSave: (name: string) => void;
  onCategoryDelete: () => void;
  onItemSave: (item: ProposalItem, patch: UpdateProposalItemInput) => void;
  onItemClick: (item: ProposalItem) => void;
  visibleColOrder: string[];
  customColumnDefs: CustomColumnDef[];
  onMoveColumn: (fromId: string, toId: string) => void;
  onHideColumn: (id: string) => void;
  onRenameCustomColumn: (defId: string, label: string) => Promise<void>;
  onDeleteCustomColumn: (defId: string) => void;
  hiddenDefaults: { id: string; label: string }[];
  onRestoreDefault: (id: string) => void;
  onAddCustomColumn: (label: string) => Promise<void>;
  proposalStatus: ProposalStatus;
  onPrefetchItems: () => void;
  activeColumnGroup: string;
  onActiveColumnGroupChange: (groupId: string) => void;
};

export function ProposalCategorySection({
  projectId,
  categoryId,
  categoryName,
  items,
  otherCategories,
  subtotalCents,
  collapsed,
  onToggle,
  onCategoryNameSave,
  onCategoryDelete,
  onItemSave,
  onItemClick,
  visibleColOrder,
  customColumnDefs,
  onMoveColumn,
  onHideColumn,
  onRenameCustomColumn,
  onDeleteCustomColumn,
  hiddenDefaults,
  onRestoreDefault,
  onAddCustomColumn,
  proposalStatus,
  onPrefetchItems,
  activeColumnGroup,
  onActiveColumnGroupChange,
}: ProposalCategorySectionProps) {
  const createItem = useCreateProposalItem(categoryId);
  const deleteItem = useDeleteProposalItem(categoryId);
  const addItemToFfe = useAddProposalItemToFfe(projectId);
  const addCategoryToFfe = useAddProposalCategoryToFfe(projectId);
  const moveItem = useMoveProposalItem();
  const reorderItems = useReorderProposalItems(categoryId);
  const materialCellPaste = useMaterialCellPaste(projectId, {
    kind: 'proposal',
    itemGroupId: categoryId,
    projectId,
  });
  const finishes = useFinishes(projectId);
  const isMobile = useIsMobileViewport();
  const { data: revisions = [] } = useProposalRevisions(projectId);
  const { data: snapshots = [] } = useRevisionSnapshots(projectId);

  const { recentIds, push: pushRecentMaterial } = useRecentMaterials(projectId);

  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(null);
  const finishNameById = useMemo(
    () => new Map((finishes.data ?? []).map((finish) => [finish.id, finish.name])),
    [finishes.data],
  );

  const snapshotsByRevThenItem = useMemo(() => {
    const map = new Map<string, Map<string, RevisionSnapshot>>();
    for (const snap of snapshots) {
      if (!map.has(snap.revisionId)) map.set(snap.revisionId, new Map());
      map.get(snap.revisionId)!.set(snap.itemId, snap);
    }
    return map;
  }, [snapshots]);

  const openRev = useMemo(
    () => revisions.find((revision) => revision.closedAt === null) ?? null,
    [revisions],
  );
  const hasOpenRevision = openRev !== null;

  const [pendingChange, setPendingChange] = useState<PendingProposalCategoryChange | null>(null);
  const [activeSwatchItemId, setActiveSwatchItemId] = useState<string | null>(null);
  const [activeSwatchPasteItemId, setActiveSwatchPasteItemId] = useState<string | null>(null);
  const handleSwatchPaste = useCallback(
    async (item: ProposalItem, file: File) => {
      if (materialCellPaste.isPasting) return;
      setActiveSwatchPasteItemId(item.id);
      try {
        await materialCellPaste.pasteIntoCell({
          itemId: item.id,
          materials: item.materials,
          file,
        });
      } finally {
        setActiveSwatchPasteItemId((current) => (current === item.id ? null : current));
      }
    },
    [materialCellPaste],
  );
  const activeSwatchItem = items.find((item) => item.id === activeSwatchItemId) ?? null;

  function handleItemSave(item: ProposalItem, patch: Omit<UpdateProposalItemInput, 'version'>) {
    const decision = prepareProposalCategoryItemSave({
      item,
      patch,
      proposalStatus,
      hasOpenRevision,
      customColumnDefs,
    });

    if (decision.kind === 'save') {
      onItemSave(item, decision.patch);
      return;
    }

    setPendingChange(decision.pendingChange);
  }

  function handleConfirm(result: ChangeConfirmResult) {
    if (!pendingChange) return;

    onItemSave(
      pendingChange.item,
      buildProposalCategoryConfirmedSave({ pendingChange, result, proposalStatus }),
    );
    setPendingChange(null);
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  const draggableColOrder = useMemo(
    () => visibleColOrder.filter((id) => !STICKY_RIGHT_COLUMN_IDS.has(id)),
    [visibleColOrder],
  );
  const visibleColumnsForPanel = useMemo<{ id: string; label: string; isCustom?: boolean }[]>(
    () =>
      draggableColOrder
        .map((colId) => {
          const meta = PROPOSAL_COLUMN_META[colId as ProposalColumnId];
          if (meta) {
            return { id: colId, label: meta.label, isCustom: false };
          }
          const customDef = customColumnDefs.find((definition) => definition.id === colId);
          if (!customDef) return null;
          return { id: colId, label: customDef.label, isCustom: true };
        })
        .filter((column) => column !== null),
    [customColumnDefs, draggableColOrder],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onMoveColumn(String(active.id), String(over.id));
    },
    [onMoveColumn],
  );

  const [dragOverInfo, setDragOverInfo] = useState<{
    overId: string;
    insertBefore: boolean;
  } | null>(null);

  const handleRowDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        setDragOverInfo(null);
        return;
      }
      const activeIndex = sortedItems.findIndex((item) => item.id === active.id);
      const overIndex = sortedItems.findIndex((item) => item.id === over.id);
      setDragOverInfo({ overId: String(over.id), insertBefore: activeIndex > overIndex });
    },
    [sortedItems],
  );

  const handleRowDragCancel = useCallback(() => setDragOverInfo(null), []);

  const handleRowDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDragOverInfo(null);
      if (!over || active.id === over.id) return;
      const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
      const newIndex = sortedItems.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const previousOrder = sortedItems.map((item) => item.id);
      const reordered = arrayMove(sortedItems, oldIndex, newIndex);
      reorderItems.mutate(
        reordered.map((item) => item.id),
        {
          onSuccess: () => {
            toast('Row moved', {
              duration: 8000,
              action: {
                label: 'Undo',
                onClick: () => reorderItems.mutate(previousOrder),
              },
            });
          },
        },
      );
    },
    [sortedItems, reorderItems],
  );

  const itemCount = items.length;
  const addableToFfeItems = useMemo(
    () => sortedItems.filter((item) => !item.linkedFfeItemId),
    [sortedItems],
  );

  const productTagPrefix = categoryName.slice(0, 2).toUpperCase();
  const nextProductTag = useMemo(() => {
    let max = 0;
    for (const item of items) {
      if (!item.productTag.startsWith(`${productTagPrefix}-`)) continue;
      const suffix = item.productTag.slice(productTagPrefix.length + 1);
      const value = Number(suffix);
      if (Number.isInteger(value) && value > max) max = value;
    }
    return `${productTagPrefix}-${max + 1}`;
  }, [items, productTagPrefix]);

  const handleAddItem = useCallback(() => {
    if (collapsed) onToggle();
    createItem.mutate(
      { sortOrder: items.length, productTag: nextProductTag, itemName: '' },
      { onSuccess: (item) => setPendingFocusItemId(item.id) },
    );
  }, [collapsed, createItem, items.length, nextProductTag, onToggle]);

  useEffect(() => {
    if (!pendingFocusItemId || collapsed) return;
    if (!sortedItems.some((item) => item.id === pendingFocusItemId)) return;
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLTableRowElement>(
        `tr[data-item-id="${pendingFocusItemId}"]`,
      );
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    setPendingFocusItemId(null);
  }, [sortedItems, pendingFocusItemId, collapsed]);

  const handleAddItemToFfe = useCallback(
    (item: ProposalItem) => {
      const displayName = proposalItemDisplayName(item);
      addItemToFfe.mutate(item.id, {
        onSuccess: () => {
          toast.success(`${displayName} added to FF&E.`);
        },
      });
    },
    [addItemToFfe],
  );

  const handleAddAllToFfe = useCallback(() => {
    if (addableToFfeItems.length === 0) return;
    addCategoryToFfe.mutate(categoryId, {
      onSuccess: () => {
        const label = addableToFfeItems.length === 1 ? 'item' : 'items';
        toast.success(`Added ${addableToFfeItems.length} ${label} to FF&E.`);
      },
    });
  }, [addCategoryToFfe, addableToFfeItems, categoryId]);

  const handleDeleteItem = useCallback(
    (item: ProposalItem) => deleteItem.mutate(item.id),
    [deleteItem],
  );

  const handleDuplicateItem = useCallback(
    (item: ProposalItem) => createItem.mutate(buildProposalItemDuplicateInput(item)),
    [createItem],
  );

  const handleMoveItem = useCallback(
    (item: ProposalItem, toCategoryId: string) =>
      moveItem.mutate({
        id: item.id,
        fromCategoryId: categoryId,
        toCategoryId,
        version: item.version,
      }),
    [moveItem, categoryId],
  );

  return (
    <GroupedTableSection>
      <ProposalCategoryHeader
        layoutMode="records"
        categoryName={categoryName}
        itemCount={itemCount}
        collapsed={collapsed}
        isMobile={isMobile}
        subtotalCents={subtotalCents}
        hasOpenRevision={hasOpenRevision}
        openRevisionLabel={openRev?.label}
        visibleColumns={visibleColumnsForPanel}
        hiddenDefaults={hiddenDefaults}
        customColumnDefs={customColumnDefs}
        activeColumnGroup={activeColumnGroup}
        onActiveColumnGroupChange={onActiveColumnGroupChange}
        onToggle={onToggle}
        onPrefetchItems={onPrefetchItems}
        onCategoryNameSave={onCategoryNameSave}
        onCategoryDelete={onCategoryDelete}
        onAddItem={handleAddItem}
        onAddAllToFfe={handleAddAllToFfe}
        addableToFfeCount={addableToFfeItems.length}
        onMoveColumn={onMoveColumn}
        onHideColumn={onHideColumn}
        onRestoreDefault={onRestoreDefault}
        onRenameCustomColumn={onRenameCustomColumn}
        onDeleteCustomColumn={onDeleteCustomColumn}
        onOpenAddColumnModal={() => setAddColumnModalOpen(true)}
        onExpand={() => setIsExpanded(true)}
      />

      {!collapsed && !isMobile && (
        <div className="min-w-0 p-3 sm:p-4">
          {sortedItems.length === 0 ? (
            <div className="rounded-sm border border-dashed border-neutral-200 bg-white px-5 py-10 text-center">
              <p className="eyebrow text-neutral-500">Schedule</p>
              <p className="mt-2 text-sm font-medium text-neutral-800">
                No items in this schedule yet.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Add the first item here, or switch schedules from the Item Library header.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleRowDragOver}
              onDragEnd={handleRowDragEnd}
              onDragCancel={handleRowDragCancel}
            >
              <SortableContext
                items={sortedItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-3">
                  {sortedItems.map((item) => (
                    <Fragment key={item.id}>
                      {dragOverInfo?.overId === item.id && dragOverInfo.insertBefore && (
                        <div aria-hidden="true" className="h-0.5 rounded-full bg-brand-500" />
                      )}
                      <ProposalRecordRow
                        item={item}
                        otherCategories={otherCategories}
                        onDelete={() => handleDeleteItem(item)}
                        onDuplicate={() => handleDuplicateItem(item)}
                        onAddToFfe={() => handleAddItemToFfe(item)}
                        onMove={(toCategoryId) => handleMoveItem(item, toCategoryId)}
                        onRowClick={() => onItemClick(item)}
                        onSwatchOpen={setActiveSwatchItemId}
                        onSwatchPaste={handleSwatchPaste}
                        isSwatchPasting={
                          materialCellPaste.isPasting && activeSwatchPasteItemId === item.id
                        }
                        getMaterialFinishName={(material) =>
                          material.finishId ? finishNameById.get(material.finishId) : undefined
                        }
                      />
                      {dragOverInfo?.overId === item.id && !dragOverInfo.insertBefore && (
                        <div aria-hidden="true" className="h-0.5 rounded-full bg-brand-500" />
                      )}
                    </Fragment>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {!collapsed && isMobile && (
        <div className="p-3">
          <ProposalCategoryMobileCards
            items={sortedItems}
            otherCategories={otherCategories}
            snapshotsByItem={
              openRev ? (snapshotsByRevThenItem.get(openRev.id) ?? new Map()) : new Map()
            }
            onDelete={handleDeleteItem}
            onDuplicate={handleDuplicateItem}
            onAddToFfe={(item) => handleAddItemToFfe(item)}
            onMove={handleMoveItem}
            onItemClick={onItemClick}
          />
        </div>
      )}

      <ProposalCategoryExpandedTable
        open={isExpanded}
        categoryName={categoryName}
        itemCount={itemCount}
        subtotalCents={subtotalCents}
        projectId={projectId}
        otherCategories={otherCategories}
        hasOpenRevision={hasOpenRevision}
        sensors={sensors}
        draggableColOrder={draggableColOrder}
        visibleColOrder={visibleColOrder}
        customColumnDefs={customColumnDefs}
        sortedItems={sortedItems}
        dragOverInfo={dragOverInfo}
        pendingFocusItemId={pendingFocusItemId}
        proposalStatus={proposalStatus}
        onClose={() => setIsExpanded(false)}
        onRenameCustomColumn={onRenameCustomColumn}
        onDeleteCustomColumn={onDeleteCustomColumn}
        onItemSave={handleItemSave}
        onItemDelete={handleDeleteItem}
        onItemDuplicate={handleDuplicateItem}
        onItemAddToFfe={handleAddItemToFfe}
        onItemMove={handleMoveItem}
        onItemClick={onItemClick}
        onSwatchOpen={setActiveSwatchItemId}
        onSwatchPaste={handleSwatchPaste}
        isSwatchPastingForItem={(itemId) =>
          materialCellPaste.isPasting && activeSwatchPasteItemId === itemId
        }
        getMaterialFinishName={(material) =>
          material.finishId ? finishNameById.get(material.finishId) : undefined
        }
        onColumnDragEnd={handleColumnDragEnd}
        onRowDragOver={handleRowDragOver}
        onRowDragEnd={handleRowDragEnd}
        onRowDragCancel={handleRowDragCancel}
      />

      <AddColumnModal
        open={addColumnModalOpen}
        onClose={() => setAddColumnModalOpen(false)}
        onSubmit={onAddCustomColumn}
      />

      {pendingChange && (
        <ChangeConfirmModal
          columnLabel={pendingChange.columnLabel}
          previousValue={pendingChange.previousValue}
          newValue={pendingChange.newValue}
          proposalStatus={proposalStatus}
          {...(openRev ? { openRevisionLabel: openRev.label } : {})}
          isPriceAffecting={pendingChange.isPriceAffecting}
          lockPriceAffecting={pendingChange.lockPriceAffecting ?? false}
          onConfirm={handleConfirm}
          onCancel={() => setPendingChange(null)}
        />
      )}

      <Suspense fallback={null}>
        {activeSwatchItem && (
          <MaterialLibraryModal
            open
            projectId={projectId}
            context="proposal"
            categoryId={categoryId}
            item={activeSwatchItem}
            recentMaterialIds={recentIds}
            onClose={() => setActiveSwatchItemId(null)}
            onMaterialAssigned={pushRecentMaterial}
          />
        )}
      </Suspense>
    </GroupedTableSection>
  );
}
