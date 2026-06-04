import { Fragment, useRef, type ComponentProps } from 'react';
import { closestCenter, DndContext, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Badge, Button } from '../../../primitives';
import { ColumnsPanel } from '../../../shared/table/ColumnsPanel';
import { ColumnGroupTabs } from '../../../shared/table/ColumnGroupTabs';
import { ColumnNavArrows } from '../../../shared/table/TableViewWrappers';
import {
  cents,
  formatMoney,
  type CustomColumnDef,
  type Material,
  type ProposalItem,
  type ProposalStatus,
} from '../../../../types';
import { cn } from '../../../../lib/utils';
import { ProposalRow } from '../row/ProposalRow';
import { SortableColHeader } from '../../../shared/table/SortableColHeader';
import { CustomColumnHeader } from '../../../shared/table/CustomColumnHeader';
import { proposalGeneratedItemStickyClassNames } from '../../../shared/table/generatedItemStickyStyles';
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
import { PROPOSAL_GENERATED_ITEM_TABLE_PRESET } from '../../../../lib/table/generatedItemTablePresets';

type DndSensors = ComponentProps<typeof DndContext>['sensors'];

type ProposalCategoryExpandedTableProps = {
  open: boolean;
  categoryName: string;
  itemCount: number;
  subtotalCents: number;
  projectId: string;
  otherCategories: { id: string; name: string }[];
  hasOpenRevision: boolean;
  openRevisionLabel?: string | undefined;
  sensors: DndSensors;
  visibleColumns: { id: string; label: string; isCustom?: boolean }[];
  hiddenDefaults: { id: string; label: string }[];
  draggableColOrder: string[];
  visibleColOrder: string[];
  customColumnDefs: CustomColumnDef[];
  activeColumnGroup: string;
  sortedItems: ProposalItem[];
  viewFilter?: 'all' | 'flagged' | undefined;
  flaggedCount?: number | undefined;
  dragOverInfo: { overId: string; insertBefore: boolean } | null;
  pendingFocusItemId: string | null;
  proposalStatus: ProposalStatus;
  onClose: () => void;
  onActiveColumnGroupChange: (groupId: string) => void;
  onRenameCustomColumn: (defId: string, label: string) => Promise<void>;
  onDeleteCustomColumn: (defId: string) => void;
  onMoveColumn: (fromId: string, toId: string) => void;
  onHideColumn: (id: string) => void;
  onRestoreDefault: (id: string) => void;
  onOpenAddColumnModal: () => void;
  onItemSave: (item: ProposalItem, patch: Omit<UpdateProposalItemInput, 'version'>) => void;
  onItemDelete: (item: ProposalItem) => void;
  onItemDuplicate: (item: ProposalItem) => void;
  onItemAddToFfe: (item: ProposalItem) => void;
  onItemMove: (item: ProposalItem, toCategoryId: string) => void;
  onItemClick: (item: ProposalItem) => void;
  onSwatchOpen: (itemId: string | null) => void;
  onSwatchPaste: (item: ProposalItem, file: File) => Promise<void>;
  isSwatchPastingForItem: (itemId: string) => boolean;
  getMaterialFinishName: (material: Material) => string | undefined;
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
  openRevisionLabel,
  sensors,
  visibleColumns,
  hiddenDefaults,
  draggableColOrder,
  visibleColOrder,
  customColumnDefs,
  activeColumnGroup,
  sortedItems,
  viewFilter = 'all',
  flaggedCount = 0,
  dragOverInfo,
  pendingFocusItemId,
  proposalStatus,
  onClose,
  onActiveColumnGroupChange,
  onRenameCustomColumn,
  onDeleteCustomColumn,
  onMoveColumn,
  onHideColumn,
  onRestoreDefault,
  onOpenAddColumnModal,
  onItemSave,
  onItemDelete,
  onItemDuplicate,
  onItemAddToFfe,
  onItemMove,
  onItemClick,
  onSwatchOpen,
  onSwatchPaste,
  isSwatchPastingForItem,
  getMaterialFinishName,
  onColumnDragEnd,
  onRowDragOver,
  onRowDragEnd,
  onRowDragCancel,
}: ProposalCategoryExpandedTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const draggableColumnIds = new Set(draggableColOrder);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (draggableColumnIds.has(String(active.id)) && draggableColumnIds.has(String(over.id))) {
      onColumnDragEnd(event);
      return;
    }
    onRowDragEnd(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (draggableColumnIds.has(String(event.active.id))) return;
    onRowDragOver(event);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/35 p-4 backdrop-blur-sm">
      <div className="flex h-full flex-col overflow-hidden rounded-sm border border-neutral-200 bg-canvas-chrome shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-canvas-chrome px-4 py-3">
          <div className="min-w-0">
            <p className="eyebrow text-brand-700">Spreadsheet View</p>
            <h2 className="truncate text-base font-semibold text-neutral-950">{categoryName}</h2>
            <p className="text-xs text-neutral-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatMoney(cents(subtotalCents))}
            </p>
            {hasOpenRevision || viewFilter === 'flagged' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hasOpenRevision ? (
                  <Badge variant="brand" size="md" className="shrink-0">
                    {openRevisionLabel
                      ? `Revision ${openRevisionLabel} in progress`
                      : 'Revision in progress'}
                  </Badge>
                ) : null}
                {viewFilter === 'flagged' ? (
                  <Badge variant="warning" size="md" className="shrink-0">
                    Flagged costs only{flaggedCount > 0 ? ` · ${flaggedCount}` : ''}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close Spreadsheet View"
              title="Close Spreadsheet View"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-canvas-chrome px-4 py-3">
          <div className="min-w-0 flex-1">
            <ColumnGroupTabs
              groups={PROPOSAL_GENERATED_ITEM_TABLE_PRESET.columnGroups}
              activeGroupId={activeColumnGroup}
              onChange={onActiveColumnGroupChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <ColumnsPanel
              title={`${categoryName} spreadsheet`}
              visibleColumns={visibleColumns}
              hiddenDefaults={hiddenDefaults}
              customColumns={customColumnDefs}
              onMoveColumn={onMoveColumn}
              onHideColumn={onHideColumn}
              onRestoreDefault={onRestoreDefault}
              onRenameCustomColumn={onRenameCustomColumn}
              onDeleteCustomColumn={onDeleteCustomColumn}
              onOpenAddColumnModal={onOpenAddColumnModal}
            />
            <ColumnNavArrows scrollRef={scrollRef} stepPx={240} />
          </div>
        </div>
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label={`${categoryName} Spreadsheet View table`}
          className="min-w-0 flex-1 overflow-auto"
        >
          <DndContext
            {...(sensors !== undefined ? { sensors } : {})}
            collisionDetection={closestCenter}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={onRowDragCancel}
          >
            <table
              className={cn(
                hasOpenRevision ? 'min-w-[1600px]' : 'min-w-[1320px]',
                'w-full border-collapse text-left text-sm',
              )}
            >
              <thead className="sticky top-0 z-30 bg-canvas-chrome text-xs">
                <tr>
                  <th className="table-head-cell sticky left-0 z-40 w-8 min-w-8 px-1" />
                  <th className="table-head-cell sticky left-8 z-40 w-24 min-w-24">ID</th>
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
                            className={cn('table-head-cell', meta.className)}
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
                          className="table-head-cell min-w-36"
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
                      <th className={cn('table-head-cell', revisionNotesColumnClassName)}>Notes</th>
                      <th
                        className={cn(
                          'table-head-cell text-neutral-500',
                          'border-l border-l-neutral-300',
                          baselineQtyColumnClassName,
                        )}
                      >
                        <span className="block text-[10px] text-neutral-400">Before</span>
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'table-head-cell text-neutral-500',
                          baselineUnitCostColumnClassName,
                        )}
                      >
                        <span className="block text-[10px] text-neutral-400">Before</span>
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'table-head-cell text-neutral-500',
                          baselineTotalColumnClassName,
                        )}
                      >
                        <span className="block text-[10px] text-neutral-400">Before</span>
                        Total
                      </th>
                      <th
                        className={cn(
                          'table-head-cell text-brand-700',
                          stickyRevQtyExpandedHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Qty
                      </th>
                      <th
                        className={cn(
                          'table-head-cell text-brand-700',
                          stickyRevUnitCostExpandedHeaderClassName,
                        )}
                      >
                        <span className="block text-[10px] text-brand-500">After</span>
                        New Cost
                      </th>
                      <th
                        className={cn(
                          'table-head-cell text-brand-700',
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
                          'table-head-cell',
                          proposalGeneratedItemStickyClassNames.byColumnId.quantity?.expandedHeader,
                        )}
                      >
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'table-head-cell',
                          proposalGeneratedItemStickyClassNames.byColumnId.unitCost?.expandedHeader,
                        )}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'table-head-cell',
                          proposalGeneratedItemStickyClassNames.byColumnId.total?.expandedHeader,
                        )}
                      >
                        Total Cost
                      </th>
                    </>
                  )}
                  <th
                    className={cn(
                      'table-head-cell',
                      proposalGeneratedItemStickyClassNames.byColumnId.actions?.expandedHeader,
                    )}
                  />
                </tr>
              </thead>
              <tbody>
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
                        onSwatchPaste={onSwatchPaste}
                        isSwatchPasting={isSwatchPastingForItem(item.id)}
                        getMaterialFinishName={getMaterialFinishName}
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
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
