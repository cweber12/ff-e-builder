import { Fragment, type ComponentProps } from 'react';
import { closestCenter, DndContext, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '../../../primitives';
import {
  cents,
  formatMoney,
  type CustomColumnDef,
  type ProposalItem,
  type ProposalStatus,
} from '../../../../types';
import { cn } from '../../../../lib/utils';
import { ProposalRow } from '../row/ProposalRow';
import { SortableColHeader } from '../../../shared/table/SortableColHeader';
import { CustomColumnHeader } from '../../../shared/table/CustomColumnHeader';
import {
  proposalStickyEdgeColumnClassNames,
  proposalStickyValueColumnClassNames,
} from '../../../shared/table/generatedItemStickyStyles';
import {
  baselineQtyColumnClassName,
  baselineTotalColumnClassName,
  baselineUnitCostColumnClassName,
  PROPOSAL_COLUMN_META,
  type ProposalColumnId,
  revisionNotesColumnClassName,
  stickyRevQtyExpandedHeaderClassName,
  stickyRevTotalExpandedHeaderClassName,
  stickyRevUnitCostExpandedHeaderClassName,
} from '../proposalTableConstants';
import type { UpdateProposalItemInput } from '../../../../lib/api';

type DndSensors = ComponentProps<typeof DndContext>['sensors'];

type ProposalCategoryExpandedTableProps = {
  open: boolean;
  categoryName: string;
  itemCount: number;
  subtotalCents: number;
  projectId: string;
  otherCategories: { id: string; name: string }[];
  hasOpenRevision: boolean;
  sensors: DndSensors;
  draggableColOrder: string[];
  visibleColOrder: string[];
  customColumnDefs: CustomColumnDef[];
  sortedItems: ProposalItem[];
  dragOverInfo: { overId: string; insertBefore: boolean } | null;
  pendingFocusItemId: string | null;
  proposalStatus: ProposalStatus;
  onClose: () => void;
  onHideColumn: (id: string) => void;
  onRenameCustomColumn: (defId: string, label: string) => Promise<void>;
  onDeleteCustomColumn: (defId: string) => void;
  onItemSave: (item: ProposalItem, patch: Omit<UpdateProposalItemInput, 'version'>) => void;
  onItemDelete: (item: ProposalItem) => void;
  onItemDuplicate: (item: ProposalItem) => void;
  onItemAddToFfe: (item: ProposalItem) => void;
  onItemMove: (item: ProposalItem, toCategoryId: string) => void;
  onItemClick: (item: ProposalItem) => void;
  onSwatchOpen: (itemId: string | null) => void;
  onColumnDragEnd: (event: DragEndEvent) => void;
  onRowDragOver: (event: DragOverEvent) => void;
  onRowDragEnd: (event: DragEndEvent) => void;
  onRowDragCancel: () => void;
};

export function ProposalCategoryExpandedTable({
  open,
  categoryName,
  itemCount,
  subtotalCents,
  projectId,
  otherCategories,
  hasOpenRevision,
  sensors,
  draggableColOrder,
  visibleColOrder,
  customColumnDefs,
  sortedItems,
  dragOverInfo,
  pendingFocusItemId,
  proposalStatus,
  onClose,
  onHideColumn,
  onRenameCustomColumn,
  onDeleteCustomColumn,
  onItemSave,
  onItemDelete,
  onItemDuplicate,
  onItemAddToFfe,
  onItemMove,
  onItemClick,
  onSwatchOpen,
  onColumnDragEnd,
  onRowDragOver,
  onRowDragEnd,
  onRowDragCancel,
}: ProposalCategoryExpandedTableProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/35 p-4 backdrop-blur-sm">
      <div className="flex h-full flex-col overflow-hidden rounded-sm border border-neutral-200 bg-canvas-chrome shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-canvas-chrome px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-neutral-950">{categoryName}</h2>
            <p className="text-xs text-neutral-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} - {formatMoney(cents(subtotalCents))}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Minimize table view"
            title="Minimize table view"
            onClick={onClose}
          >
            Minimize
          </Button>
        </div>
        <div
          tabIndex={0}
          aria-label={`${categoryName} expanded items table`}
          className="min-w-0 flex-1 overflow-auto"
        >
          <table
            className={cn(
              hasOpenRevision ? 'min-w-[1600px]' : 'min-w-[1320px]',
              'w-full border-collapse text-left text-sm',
            )}
          >
            <thead className="sticky top-0 z-30 bg-canvas-chrome text-xs">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onColumnDragEnd}
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
                      const customDef = customColumnDefs.find(
                        (definition) => definition.id === colId,
                      );
                      if (!customDef) return null;
                      return (
                        <SortableColHeader
                          key={colId}
                          colId={colId}
                          className="h-10 min-w-36 border-b border-neutral-200 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600"
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
                          stickyRevQtyExpandedHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Qty
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-brand-700',
                          stickyRevUnitCostExpandedHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-brand-700',
                          stickyRevTotalExpandedHeaderClassName,
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
                          proposalStickyValueColumnClassNames.quantity.expandedHeader,
                        )}
                      >
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyValueColumnClassNames.unitCost.expandedHeader,
                        )}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-neutral-200 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyEdgeColumnClassNames.totalExpandedHeader,
                        )}
                      >
                        Total Cost
                      </th>
                    </>
                  )}
                  <th
                    className={cn(
                      'h-10 border-b border-neutral-200',
                      proposalStickyEdgeColumnClassNames.actionsExpandedHeader,
                    )}
                  />
                </tr>
              </DndContext>
            </thead>
            <tbody>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragOver={onRowDragOver}
                onDragEnd={onRowDragEnd}
                onDragCancel={onRowDragCancel}
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
                        onSave={(patch) => onItemSave(item, patch)}
                        onDelete={() => onItemDelete(item)}
                        onDuplicate={() => onItemDuplicate(item)}
                        onAddToFfe={() => onItemAddToFfe(item)}
                        onMove={(toCategoryId) => onItemMove(item, toCategoryId)}
                        onRowClick={() => onItemClick(item)}
                        visibleColOrder={visibleColOrder}
                        customColumnDefs={customColumnDefs}
                        proposalStatus={proposalStatus}
                        onSwatchOpen={onSwatchOpen}
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
      </div>
    </div>
  );
}
