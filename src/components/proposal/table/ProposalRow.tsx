import { Fragment, memo, type MouseEvent, type ReactNode } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import {
  cents,
  formatMoney,
  type CustomColumnDef,
  type ProposalItem,
  type ProposalStatus,
} from '../../../types';
import { proposalLineTotalCents } from '../../../lib/money';
import type { UpdateProposalItemInput } from '../../../lib/api';
import { useRevisionInfoForItem, useTableDensity, densityRowClass } from '../../../hooks';
import { cn } from '../../../lib/utils';
import { GeneratedItemDragHandle } from '../../shared/table/GeneratedItemDragHandle';
import {
  GeneratedItemEditableMoneyCell,
  GeneratedItemEditableNumberCell,
  GeneratedItemEditableQuantityCell,
} from '../../shared/table/GeneratedItemEditableNumberCell';
import { GeneratedItemEditableTextCell } from '../../shared/table/GeneratedItemEditableTextCell';
import { GeneratedItemImageCell } from '../../shared/table/GeneratedItemImageCell';
import { GeneratedItemMaterialsCell } from '../../shared/table/GeneratedItemMaterialsCell';
import { GeneratedItemSizeCell } from '../../shared/table/GeneratedItemSizeModal';
import {
  proposalStickyEdgeColumnClassNames,
  proposalStickyValueColumnClassNames,
} from '../../shared/table/generatedItemStickyStyles';
import {
  RevisionCostCell,
  GeneratedItemColumnChangeDot,
  RevisionNotesCell,
  RevisionQtyCell,
  RevisionTotalCell,
} from '../revision';
import {
  baselineQtyColumnClassName,
  baselineTotalColumnClassName,
  baselineUnitCostColumnClassName,
  editInputClassName,
  quantityUnits,
  revisionNotesColumnClassName,
  stickyRevQtyCellClassName,
  stickyRevTotalCellClassName,
  stickyRevUnitCostCellClassName,
} from './proposalTableConstants';
import { ProposalItemActionsMenu } from './ProposalItemActionsMenu';

const PROPOSAL_CELL_DEBOUNCE_MS = 400;

type ProposalRowProps = {
  projectId: string;
  item: ProposalItem;
  otherCategories: { id: string; name: string }[];
  onSave: (patch: Omit<UpdateProposalItemInput, 'version'>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddToFfe: () => void;
  onMove: (toCategoryId: string) => void;
  onRowClick: () => void;
  visibleColOrder: string[];
  customColumnDefs: CustomColumnDef[];
  proposalStatus: ProposalStatus;
  onSwatchOpen: (itemId: string) => void;
  autoFocusItemName?: boolean;
};

export function ProposalRow({
  projectId,
  item,
  otherCategories,
  onSave,
  onDelete,
  onDuplicate,
  onAddToFfe,
  onMove,
  onRowClick,
  visibleColOrder,
  customColumnDefs,
  proposalStatus,
  onSwatchOpen,
  autoFocusItemName,
}: ProposalRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const dragTransform = CSS.Transform.toString(transform);
  return (
    <ProposalRowContent
      projectId={projectId}
      item={item}
      otherCategories={otherCategories}
      onSave={onSave}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onAddToFfe={onAddToFfe}
      onMove={onMove}
      onRowClick={onRowClick}
      visibleColOrder={visibleColOrder}
      customColumnDefs={customColumnDefs}
      proposalStatus={proposalStatus}
      onSwatchOpen={onSwatchOpen}
      autoFocusItemName={autoFocusItemName ?? false}
      dragRef={setNodeRef}
      dragTransform={dragTransform}
      dragTransition={transition}
      isDragging={isDragging}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

const ProposalRowContent = memo(
  function ProposalRowContent({
    projectId,
    item,
    otherCategories,
    onSave,
    onDelete,
    onDuplicate,
    onAddToFfe,
    onMove,
    onRowClick,
    visibleColOrder,
    customColumnDefs,
    proposalStatus,
    onSwatchOpen,
    autoFocusItemName,
    dragRef,
    dragTransform,
    dragTransition,
    isDragging,
    dragAttributes,
    dragListeners,
  }: {
    projectId: string;
    item: ProposalItem;
    otherCategories: { id: string; name: string }[];
    onSave: (patch: Omit<UpdateProposalItemInput, 'version'>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onAddToFfe: () => void;
    onMove: (toCategoryId: string) => void;
    onRowClick: () => void;
    visibleColOrder: string[];
    customColumnDefs: CustomColumnDef[];
    proposalStatus: ProposalStatus;
    onSwatchOpen: (itemId: string) => void;
    autoFocusItemName?: boolean;
    dragRef: (node: HTMLElement | null) => void;
    dragTransform: string | undefined;
    dragTransition: string | null | undefined;
    isDragging: boolean;
    dragAttributes: ReturnType<typeof useSortable>['attributes'];
    dragListeners: ReturnType<typeof useSortable>['listeners'];
  }) {
    const { openRev, revisions, snapshot, changelog } = useRevisionInfoForItem(projectId, item.id);
    const { density } = useTableDensity();

    const style = { transform: dragTransform, transition: dragTransition ?? undefined };
    const lineTotal = proposalLineTotalCents(item);
    const stopProp = (e: MouseEvent) => e.stopPropagation();

    const showDots = proposalStatus !== 'in_progress';
    const dot = (columnKey: string) =>
      showDots ? (
        <GeneratedItemColumnChangeDot
          itemId={item.id}
          columnKey={columnKey}
          revisions={revisions}
        />
      ) : null;

    const cellRenderMap: Record<string, ReactNode> = {
      rendering: (
        <GeneratedItemImageCell
          view="proposal"
          kind="rendering"
          entityId={item.id}
          alt={`${item.productTag || 'Proposal'} rendering`}
          tdClassName="py-3"
          onClick={stopProp}
        />
      ),
      itemName: (
        <GeneratedItemEditableTextCell
          value={item.itemName}
          onSave={(itemName) => onSave({ itemName })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="min-w-48 py-3"
          indicator={dot('itemName')}
          inputClassName={editInputClassName}
          affordance="hover"
          autoFocus={autoFocusItemName ?? false}
        />
      ),
      plan: (
        <GeneratedItemImageCell
          view="proposal"
          kind="plan"
          entityId={item.id}
          alt={`${item.productTag || 'Proposal'} plan`}
          tdClassName="py-3"
          onClick={stopProp}
        />
      ),
      drawings: (
        <GeneratedItemEditableTextCell
          value={item.drawings}
          onSave={(drawings) => onSave({ drawings })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="py-3"
          indicator={dot('drawings')}
          inputClassName={editInputClassName}
          affordance="hover"
          multiline
        />
      ),
      location: (
        <GeneratedItemEditableTextCell
          value={item.location}
          onSave={(location) => onSave({ location })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="py-3"
          indicator={dot('location')}
          inputClassName={editInputClassName}
          affordance="hover"
          multiline
        />
      ),
      description: (
        <GeneratedItemEditableTextCell
          value={item.description}
          onSave={(description) => onSave({ description })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="min-w-64 py-3"
          indicator={dot('description')}
          inputClassName={editInputClassName}
          affordance="hover"
          multiline
        />
      ),
      notes: (
        <GeneratedItemEditableTextCell
          value={item.notes}
          onSave={(notes) => onSave({ notes })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="min-w-48 py-3"
          indicator={dot('notes')}
          inputClassName={editInputClassName}
          affordance="hover"
          multiline
        />
      ),
      size: (
        <GeneratedItemSizeCell
          value={item.sizeLabel}
          initial={{
            mode: item.sizeMode,
            unit: item.sizeUnit,
            w: item.sizeW,
            d: item.sizeD,
            h: item.sizeH,
          }}
          indicator={dot('size')}
          onSave={({ label, mode, unit, w, d, h }) =>
            onSave({
              sizeMode: mode,
              sizeUnit: unit,
              sizeW: w,
              sizeD: d,
              sizeH: h,
              sizeLabel: label,
            })
          }
          tdClassName="py-3"
        />
      ),
      swatch: (
        <GeneratedItemMaterialsCell
          materials={item.materials}
          onOpen={() => onSwatchOpen(item.id)}
          tdClassName="py-3"
        />
      ),
      cbm: (
        <GeneratedItemEditableNumberCell
          value={item.cbm}
          step="0.001"
          onSave={(cbm) => onSave({ cbm })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="w-24"
          tdClassName="py-3"
          inputClassName={editInputClassName}
          indicator={dot('cbm')}
        />
      ),
      ...Object.fromEntries(
        customColumnDefs.map((def) => [
          def.id,
          <GeneratedItemEditableTextCell
            value={item.customData[def.id] ?? ''}
            onSave={(value) => {
              onSave({ customData: { ...item.customData, [def.id]: value } });
            }}
            debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
            className="py-3"
            indicator={dot(def.id)}
            inputClassName={editInputClassName}
            affordance="hover"
            multiline
          />,
        ]),
      ),
    };

    return (
      <tr
        ref={dragRef}
        style={style}
        tabIndex={0}
        data-dragging={isDragging || undefined}
        data-item-id={item.id}
        aria-label={`Open details for ${item.itemName || item.productTag || 'item'}`}
        onClick={onRowClick}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          onRowClick();
        }}
        className={cn(
          'group cursor-pointer border-b border-black/10 align-top last:border-b-0',
          densityRowClass(density),
          'motion-reduce:transition-none motion-safe:transition-colors hover:bg-canvas-shell/70',
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
          isDragging && 'bg-brand-50 shadow-md opacity-80',
        )}
      >
        <td
          className="sticky left-0 z-20 w-8 min-w-8 bg-canvas-chrome px-1 py-3 group-hover:bg-canvas-shell/90"
          onClick={stopProp}
        >
          <GeneratedItemDragHandle
            ariaLabel={`Drag ${item.productTag || 'item'}`}
            {...dragAttributes}
            {...dragListeners}
          />
        </td>
        <GeneratedItemEditableTextCell
          value={item.productTag}
          onSave={(productTag) => onSave({ productTag })}
          debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
          className="sticky left-8 z-20 w-24 min-w-24 bg-canvas-chrome py-3 group-hover:bg-canvas-shell/90"
          indicator={dot('productTag')}
          inputClassName={editInputClassName}
          displayClassName="inline-flex w-auto max-w-full rounded-pill bg-brand-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-brand-700 hover:bg-brand-100"
          affordance="hover"
        />
        {visibleColOrder.map((colId) => (
          <Fragment key={colId}>{cellRenderMap[colId]}</Fragment>
        ))}
        {openRev ? (
          (() => {
            const revEntries = changelog;
            return (
              <>
                <RevisionNotesCell
                  entries={revEntries}
                  tdClassName={revisionNotesColumnClassName}
                />
                <td
                  className={cn(
                    'px-3 py-3 text-sm tabular-nums text-neutral-400',
                    baselineQtyColumnClassName,
                  )}
                >
                  {item.quantity} {item.quantityUnit}
                </td>
                <td
                  className={cn(
                    'px-3 py-3 text-sm tabular-nums text-neutral-400',
                    baselineUnitCostColumnClassName,
                  )}
                >
                  {formatMoney(cents(item.unitCostCents))}
                </td>
                <td
                  className={cn(
                    'px-3 py-3 text-sm tabular-nums text-neutral-400',
                    baselineTotalColumnClassName,
                  )}
                >
                  {formatMoney(cents(lineTotal))}
                </td>
                <RevisionQtyCell
                  snapshot={snapshot}
                  currentQuantity={item.quantity}
                  currentUnit={item.quantityUnit}
                  onSaveQuantity={(quantity) => onSave({ quantity })}
                  tdClassName={cn(stickyRevQtyCellClassName, 'py-3')}
                />
                <RevisionCostCell
                  snapshot={snapshot}
                  projectId={projectId}
                  revisionId={openRev.id}
                  itemId={item.id}
                  tdClassName={cn(stickyRevUnitCostCellClassName, 'py-3')}
                />
                <RevisionTotalCell
                  snapshot={snapshot}
                  tdClassName={cn(stickyRevTotalCellClassName, 'py-3')}
                />
              </>
            );
          })()
        ) : (
          <>
            <GeneratedItemEditableQuantityCell
              quantity={item.quantity}
              quantityUnit={item.quantityUnit}
              quantityUnits={quantityUnits}
              onSaveQuantity={(quantity) => onSave({ quantity })}
              onSaveUnit={(quantityUnit) => onSave({ quantityUnit })}
              debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
              indicator={dot('quantity')}
              tdClassName={cn(proposalStickyValueColumnClassNames.quantity.cell, 'py-3')}
              inputClassName={editInputClassName}
            />
            <GeneratedItemEditableMoneyCell
              valueCents={item.unitCostCents}
              onSave={(unitCostCents) => onSave({ unitCostCents })}
              debounceMs={PROPOSAL_CELL_DEBOUNCE_MS}
              indicator={dot('unitCostCents')}
              tdClassName={cn(proposalStickyValueColumnClassNames.unitCost.cell, 'py-3')}
              inputClassName={editInputClassName}
            />
            <td
              className={cn(
                'px-3 py-3 font-semibold text-neutral-900',
                proposalStickyEdgeColumnClassNames.totalCell,
              )}
            >
              {formatMoney(cents(lineTotal))}
            </td>
          </>
        )}
        <td
          className={cn('px-1 py-3', proposalStickyEdgeColumnClassNames.actionsCell)}
          onClick={stopProp}
        >
          <ProposalItemActionsMenu
            itemName={item.itemName || item.productTag || item.description || 'item'}
            otherCategories={otherCategories}
            onViewDetails={onRowClick}
            onDuplicate={onDuplicate}
            onAddToFfe={onAddToFfe}
            onMove={onMove}
            onDelete={onDelete}
          />
        </td>
      </tr>
    );
  },
  (prev, next) => {
    if (prev.item.id !== next.item.id) return false;
    if (prev.item.version !== next.item.version) return false;
    if (prev.isDragging !== next.isDragging) return false;
    if (prev.dragTransform !== next.dragTransform) return false;
    if (prev.proposalStatus !== next.proposalStatus) return false;
    if (prev.visibleColOrder !== next.visibleColOrder) return false;
    if (prev.customColumnDefs !== next.customColumnDefs) return false;
    if (prev.otherCategories !== next.otherCategories) return false;
    return true;
  },
);
