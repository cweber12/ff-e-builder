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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { toast } from '../../../primitives/toast-api';
import {
  type CustomColumnDef,
  type ProposalItem,
  type ProposalStatus,
  type RevisionSnapshot,
} from '../../../../types';
import {
  useAddProposalItemToFfe,
  useCreateProposalItem,
  useDeleteProposalItem,
  useIsMobileViewport,
  useMoveProposalItem,
  useProposalRevisions,
  useRecentMaterials,
  useReorderProposalItems,
  useRevisionSnapshots,
} from '../../../../hooks';
import type { UpdateProposalItemInput } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';
import {
  proposalPatchToGeneratedItemChangeInfo,
  type GeneratedItemChangeInfo,
} from '../../../../lib/table/generatedItemChangeInfo';
import { GroupedTableSection } from '../../../shared/table/TableViewWrappers';
import { SortableColHeader } from '../../../shared/table/SortableColHeader';
import { CustomColumnHeader } from '../../../shared/table/CustomColumnHeader';
import {
  proposalStickyEdgeColumnClassNames,
  proposalStickyValueColumnClassNames,
} from '../../../shared/table/generatedItemStickyStyles';
import { ProposalRow } from '../row/ProposalRow';
import { ProposalCategoryHeader } from './ProposalCategoryHeader';
import { ProposalCategoryMobileCards } from './ProposalCategoryMobileCards';
import { ProposalCategoryExpandedTable } from './ProposalCategoryExpandedTable';
import { AddColumnModal } from '../../../shared/modals/AddColumnModal';
import {
  ChangeConfirmModal,
  type ChangeConfirmResult,
} from '../../../shared/modals/ChangeConfirmModal';
import {
  baselineQtyColumnClassName,
  baselineTotalColumnClassName,
  baselineUnitCostColumnClassName,
  PROPOSAL_COLUMN_META,
  type ProposalColumnId,
  revisionNotesColumnClassName,
  STICKY_RIGHT_COLUMN_IDS,
  stickyRevQtyHeaderClassName,
  stickyRevTotalHeaderClassName,
  stickyRevUnitCostHeaderClassName,
} from '../proposalTableConstants';

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
}: ProposalCategorySectionProps) {
  const createItem = useCreateProposalItem(categoryId);
  const deleteItem = useDeleteProposalItem(categoryId);
  const addItemToFfe = useAddProposalItemToFfe(projectId);
  const moveItem = useMoveProposalItem();
  const reorderItems = useReorderProposalItems(categoryId);
  const isMobile = useIsMobileViewport();
  const { data: revisions = [] } = useProposalRevisions(projectId);
  const { data: snapshots = [] } = useRevisionSnapshots(projectId);

  const { recentIds, push: pushRecentMaterial } = useRecentMaterials(projectId);

  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(null);

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

  type PendingChange = GeneratedItemChangeInfo & {
    item: ProposalItem;
    patch: Omit<UpdateProposalItemInput, 'version'>;
  };

  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [activeSwatchItemId, setActiveSwatchItemId] = useState<string | null>(null);
  const activeSwatchItem = items.find((item) => item.id === activeSwatchItemId) ?? null;

  function handleItemSave(item: ProposalItem, patch: Omit<UpdateProposalItemInput, 'version'>) {
    if (proposalStatus === 'in_progress' && !hasOpenRevision) {
      onItemSave(item, { ...patch, version: item.version });
      return;
    }

    const changeInfo = proposalPatchToGeneratedItemChangeInfo(patch, item, customColumnDefs);
    if (!changeInfo) {
      onItemSave(item, { ...patch, version: item.version });
      return;
    }

    if (!changeInfo.isPriceAffecting) {
      onItemSave(item, {
        ...patch,
        version: item.version,
        changeLog: {
          columnKey: changeInfo.columnKey,
          previousValue: changeInfo.previousValue,
          newValue: changeInfo.newValue,
          proposalStatus,
          isPriceAffecting: false,
        },
      });
      return;
    }

    setPendingChange({ ...changeInfo, item, patch });
  }

  function handleConfirm(result: ChangeConfirmResult) {
    if (!pendingChange) return;

    const { item, patch, columnKey, previousValue, newValue } = pendingChange;
    const changeLog: NonNullable<UpdateProposalItemInput['changeLog']> = {
      columnKey,
      previousValue,
      newValue,
      proposalStatus,
    };

    if (result.notes) changeLog.notes = result.notes;
    changeLog.isPriceAffecting = result.isPriceAffecting;

    onItemSave(item, {
      ...patch,
      version: item.version,
      changeLog,
    });
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

  const duplicateItemPayload = useCallback(
    (item: ProposalItem) => ({
      productTag: item.productTag,
      description: item.description,
      plan: item.plan,
      drawings: item.drawings,
      location: item.location,
      sizeLabel: item.sizeLabel,
      sizeMode: item.sizeMode,
      sizeUnit: item.sizeUnit,
      sizeW: item.sizeW,
      sizeD: item.sizeD,
      sizeH: item.sizeH,
      cbm: item.cbm,
      quantity: item.quantity,
      quantityUnit: item.quantityUnit,
      unitCostCents: item.unitCostCents,
      sortOrder: item.sortOrder + 0.5,
      ...(Object.keys(item.customData).length > 0 && { customData: item.customData }),
    }),
    [],
  );

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
      const displayName = item.itemName || item.productTag || item.description || 'Item';
      const locationName = item.location || 'Unassigned';
      addItemToFfe.mutate(item.id, {
        onSuccess: () => {
          toast.success(`${displayName} added to FF&E location ${locationName}.`);
        },
      });
    },
    [addItemToFfe],
  );

  const handleDeleteItem = useCallback(
    (item: ProposalItem) => deleteItem.mutate(item.id),
    [deleteItem],
  );

  const handleDuplicateItem = useCallback(
    (item: ProposalItem) => createItem.mutate(duplicateItemPayload(item)),
    [createItem, duplicateItemPayload],
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
        onToggle={onToggle}
        onPrefetchItems={onPrefetchItems}
        onCategoryNameSave={onCategoryNameSave}
        onCategoryDelete={onCategoryDelete}
        onAddItem={handleAddItem}
        onMoveColumn={onMoveColumn}
        onHideColumn={onHideColumn}
        onRestoreDefault={onRestoreDefault}
        onRenameCustomColumn={onRenameCustomColumn}
        onDeleteCustomColumn={onDeleteCustomColumn}
        onOpenAddColumnModal={() => setAddColumnModalOpen(true)}
        onExpand={() => setIsExpanded(true)}
      />

      {!collapsed && !isMobile && (
        <div className="min-w-0">
          <table
            className={cn(
              hasOpenRevision ? 'min-w-[1600px]' : 'min-w-[1320px]',
              'w-full border-collapse text-left text-sm',
            )}
          >
            <thead className="sticky top-11 z-30 bg-canvas-chrome text-xs">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}
              >
                <tr>
                  <th className="sticky left-0 z-40 h-10 w-8 min-w-8 border-b border-neutral-200 bg-canvas-chrome px-1" />
                  <th className="sticky left-8 z-40 h-10 w-24 min-w-24 border-b border-neutral-200 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600">
                    ID
                  </th>
                  <SortableContext
                    items={draggableColOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {draggableColOrder.map((colId) => {
                      const meta = PROPOSAL_COLUMN_META[colId as ProposalColumnId];
                      if (meta) {
                        return (
                          <SortableColHeader
                            key={colId}
                            colId={colId}
                            label={meta.label}
                            className={cn(
                              'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600 bg-canvas-chrome',
                              meta.className,
                            )}
                            onHide={() => onHideColumn(colId)}
                          />
                        );
                      }
                      const customDef = customColumnDefs.find((def) => def.id === colId);
                      if (!customDef) return null;
                      return (
                        <SortableColHeader
                          key={colId}
                          colId={colId}
                          className="h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600 bg-canvas-chrome min-w-36"
                          onHide={() => onHideColumn(colId)}
                        >
                          <CustomColumnHeader
                            def={customDef}
                            onDelete={() => onDeleteCustomColumn(customDef.id)}
                            onRename={(label) => onRenameCustomColumn(customDef.id, label)}
                          />
                        </SortableColHeader>
                      );
                    })}
                  </SortableContext>
                  {hasOpenRevision ? (
                    <>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          revisionNotesColumnClassName,
                        )}
                      >
                        Notes
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-500',
                          'border-l border-l-neutral-300',
                          baselineQtyColumnClassName,
                        )}
                      >
                        <span className="block text-[10px] text-neutral-400">Before</span>
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-500',
                          baselineUnitCostColumnClassName,
                        )}
                      >
                        <span className="block text-[10px] text-neutral-400">Before</span>
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-500',
                          baselineTotalColumnClassName,
                        )}
                      >
                        <span className="block text-[10px] text-neutral-400">Before</span>
                        Total
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-brand-700',
                          stickyRevQtyHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Qty
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-brand-700',
                          stickyRevUnitCostHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-brand-700',
                          stickyRevTotalHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Total
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyValueColumnClassNames.quantity.header,
                        )}
                      >
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyValueColumnClassNames.unitCost.header,
                        )}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyEdgeColumnClassNames.totalHeader,
                        )}
                      >
                        Total Cost
                      </th>
                    </>
                  )}
                  <th
                    className={cn(
                      'h-10 border-b border-neutral-200',
                      proposalStickyEdgeColumnClassNames.actionsHeader,
                    )}
                  />
                </tr>
              </DndContext>
            </thead>
            <tbody>
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
                  {sortedItems.map((item) => (
                    <Fragment key={item.id}>
                      {dragOverInfo?.overId === item.id && dragOverInfo.insertBefore && (
                        <tr aria-hidden="true" className="motion-reduce:hidden">
                          <td colSpan={999} className="h-0.5 bg-brand-500 p-0" />
                        </tr>
                      )}
                      <ProposalRow
                        projectId={projectId}
                        item={item}
                        otherCategories={otherCategories}
                        onSave={(patch) => handleItemSave(item, patch)}
                        onDelete={() => handleDeleteItem(item)}
                        onDuplicate={() => handleDuplicateItem(item)}
                        onAddToFfe={() => handleAddItemToFfe(item)}
                        onMove={(toCategoryId) => handleMoveItem(item, toCategoryId)}
                        onRowClick={() => onItemClick(item)}
                        visibleColOrder={visibleColOrder}
                        customColumnDefs={customColumnDefs}
                        proposalStatus={proposalStatus}
                        onSwatchOpen={setActiveSwatchItemId}
                        autoFocusItemName={item.id === pendingFocusItemId}
                      />
                      {dragOverInfo?.overId === item.id && !dragOverInfo.insertBefore && (
                        <tr aria-hidden="true" className="motion-reduce:hidden">
                          <td colSpan={999} className="h-0.5 bg-brand-500 p-0" />
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>
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
        onHideColumn={onHideColumn}
        onRenameCustomColumn={onRenameCustomColumn}
        onDeleteCustomColumn={onDeleteCustomColumn}
        onItemSave={handleItemSave}
        onItemDelete={handleDeleteItem}
        onItemDuplicate={handleDuplicateItem}
        onItemAddToFfe={handleAddItemToFfe}
        onItemMove={handleMoveItem}
        onItemClick={onItemClick}
        onSwatchOpen={setActiveSwatchItemId}
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
