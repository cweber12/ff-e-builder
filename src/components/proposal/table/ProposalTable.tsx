import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
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
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Modal } from '../../primitives';
import { TotalsBar } from '../../shared/TotalsBar';
import { ProposalItemDetailPanel } from './ProposalItemDetailPanel';
import { ImageFrame } from '../../shared/image/ImageFrame';
import {
  useCreateProposalCategory,
  useCreateProposalItem,
  useDeleteProposalCategory,
  useDeleteProposalItem,
  useMoveProposalItem,
  useProposalWithItems,
  useUpdateProposalCategory,
  useUpdateProposalItem,
  useProposalItemChangelog,
  useColumnConfig,
  useColumnDefs,
  useCreateColumnDef,
  useUpdateColumnDef,
  useDeleteColumnDef,
  useIsMobileViewport,
  useProposalRevisions,
} from '../../../hooks';
import { MaterialBadges, MaterialLibraryModal } from '../../materials';
import {
  dollarsToCents,
  cents,
  formatMoney,
  parseUnitCostDollarsInput,
  type Project,
  type ProposalItem,
  type ProposalItemChangelogEntry,
  type ProposalCategoryWithItems,
  type CustomColumnDef,
  type ProposalRevision,
  type ProposalStatus,
  type RevisionSnapshot,
} from '../../../types';
import {
  proposalCategorySubtotalCents,
  proposalLineTotalCents,
  proposalProjectTotalCents,
} from '../../../lib/money';
import type { UpdateProposalItemInput } from '../../../lib/api';
import { DimensionEditorModal } from '../../shared/modals/DimensionEditorModal';
import {
  GroupedTableHeader,
  GroupedTableSection,
  TableViewStack,
} from '../../shared/table/TableViewWrappers';
import { AddGroupModal } from '../../shared/modals/AddGroupModal';
import { SortableColHeader } from '../../shared/table/SortableColHeader';
import { CustomColumnHeader } from '../../shared/table/CustomColumnHeader';
import { AddColumnModal } from '../../shared/modals/AddColumnModal';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/utils';
import { proposalStatusConfig } from '../proposalStatusConfig';
import { ChangeConfirmModal, type ChangeConfirmResult } from '../ChangeConfirmModal';
import {
  RevisionCostCell,
  RevisionNotesCell,
  RevisionQtyCell,
  RevisionTotalCell,
} from '../revision';

// --- Changelog helpers ---

type ChangeInfo = {
  columnKey: string;
  columnLabel: string;
  previousValue: string;
  newValue: string;
  isPriceAffecting: boolean;
};

function formatSizeDisplay(item: {
  sizeW?: string;
  sizeD?: string;
  sizeH?: string;
  sizeUnit?: string;
}): string {
  const parts = [
    item.sizeW && `${item.sizeW}W`,
    item.sizeD && `${item.sizeD}D`,
    item.sizeH && `${item.sizeH}H`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' × ')} ${item.sizeUnit ?? ''}`.trim() : '';
}

function patchToChangeInfo(
  patch: Omit<UpdateProposalItemInput, 'version'>,
  item: ProposalItem,
  customColumnDefs: CustomColumnDef[],
): ChangeInfo | null {
  const sizeFields = ['sizeW', 'sizeD', 'sizeH', 'sizeLabel', 'sizeMode', 'sizeUnit'] as const;
  if (sizeFields.some((f) => f in patch)) {
    return {
      columnKey: 'size',
      columnLabel: 'Size',
      previousValue: formatSizeDisplay(item),
      newValue: formatSizeDisplay({ ...item, ...patch }),
      isPriceAffecting: true,
    };
  }
  if ('quantity' in patch) {
    return {
      columnKey: 'quantity',
      columnLabel: 'Quantity',
      previousValue: `${item.quantity} ${item.quantityUnit}`,
      newValue: `${patch.quantity ?? ''} ${item.quantityUnit}`,
      isPriceAffecting: true,
    };
  }
  if ('cbm' in patch) {
    return {
      columnKey: 'cbm',
      columnLabel: 'CBM',
      previousValue: String(item.cbm),
      newValue: String(patch.cbm ?? ''),
      isPriceAffecting: true,
    };
  }
  if ('unitCostCents' in patch) {
    return {
      columnKey: 'unitCostCents',
      columnLabel: 'Unit Cost',
      previousValue: formatMoney(cents(item.unitCostCents)),
      newValue: formatMoney(cents(patch.unitCostCents ?? 0)),
      isPriceAffecting: false,
    };
  }
  const textFields: { key: keyof typeof patch; label: string }[] = [
    { key: 'productTag', label: 'Product Tag' },
    { key: 'plan', label: 'Plan' },
    { key: 'drawings', label: 'Drawings' },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description' },
    { key: 'notes', label: 'Notes' },
    { key: 'quantityUnit', label: 'Quantity Unit' },
  ];
  for (const { key, label } of textFields) {
    if (key in patch) {
      const prevVal = item[key as keyof ProposalItem];
      const newVal = (patch as Record<string, unknown>)[key];
      return {
        columnKey: key,
        columnLabel: label,
        previousValue: typeof prevVal === 'string' ? prevVal : '',
        newValue: typeof newVal === 'string' ? newVal : '',
        isPriceAffecting: false,
      };
    }
  }
  if ('customData' in patch && patch.customData) {
    const changedKey = Object.keys(patch.customData)[0];
    if (changedKey) {
      const def = customColumnDefs.find((d) => d.id === changedKey);
      return {
        columnKey: changedKey,
        columnLabel: def?.label ?? 'Custom Field',
        previousValue: item.customData[changedKey] ?? '',
        newValue: patch.customData[changedKey] ?? '',
        isPriceAffecting: false,
      };
    }
  }
  return null;
}

// --- Proposal Status ---

function formatStatusDate(isoString: string): string {
  const date = new Date(isoString);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function ChangeHistoryDot({
  itemId,
  columnKey,
  revisions,
}: {
  itemId: string;
  columnKey: string;
  revisions: ProposalRevision[];
}) {
  const { data: changelog = [] } = useProposalItemChangelog(itemId);

  // Build a label map from the current-cycle revisions (already scoped by the
  // GET endpoint to currentMajor). Filter changelog to only current-cycle entries
  // so dots don't surface history from prior acceptance cycles after preservation.
  const revisionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const rev of revisions) map.set(rev.id, rev.label);
    return map;
  }, [revisions]);

  const entries = useMemo(
    () =>
      changelog.filter(
        (e) =>
          e.columnKey === columnKey && e.revisionId !== null && revisionLabelMap.has(e.revisionId),
      ),
    [changelog, columnKey, revisionLabelMap],
  );

  type EntryGroup = { label: string; entries: typeof entries };
  const groupedEntries = useMemo(() => {
    const groups: EntryGroup[] = [];
    const seen = new Map<string, EntryGroup>();
    for (const entry of entries) {
      const key = entry.revisionId!;
      const label = revisionLabelMap.get(key) ?? 'Unknown';
      if (!seen.has(key)) {
        const g: EntryGroup = { label, entries: [] };
        groups.push(g);
        seen.set(key, g);
      }
      seen.get(key)!.entries.push(entry);
    }
    return groups;
  }, [entries, revisionLabelMap]);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: globalThis.MouseEvent) {
      const inTrigger = triggerRef.current?.contains(e.target as Node) ?? false;
      const inPopup = popupRef.current?.contains(e.target as Node) ?? false;
      if (!inTrigger && !inPopup) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (entries.length === 0) return null;

  const latest = entries[0]!;
  const cfg = proposalStatusConfig[latest.proposalStatus];
  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="View change history"
        className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dotClass)}
      />
      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              left: triggerRect.left,
            }}
            className="z-[100] min-w-56 max-w-xs rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
              Change history
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {groupedEntries.map((group) => (
                <Fragment key={group.label}>
                  <li className="sticky top-0 border-b border-gray-100 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.label !== 'General' ? `Round ${group.label}` : 'General'}
                  </li>
                  {group.entries.map((entry) => (
                    <li key={entry.id} className="divide-y divide-gray-50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full flex-shrink-0',
                            proposalStatusConfig[entry.proposalStatus].dotClass,
                          )}
                        />
                        <span className="text-gray-400">{formatStatusDate(entry.changedAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="text-gray-400 line-through">
                          {entry.previousValue || '—'}
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className="font-medium text-gray-700">{entry.newValue || '—'}</span>
                      </div>
                      {entry.notes && <p className="mt-0.5 text-gray-500 italic">{entry.notes}</p>}
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

// --- Proposal Table Column Definitions ---
// quantity and unitCost are fixed sticky-right columns — not draggable or hideable.
const STICKY_RIGHT_COLUMN_IDS = new Set(['quantity', 'unitCost']);

const PROPOSAL_HIDEABLE_IDS = [
  'rendering',
  'productTag',
  'plan',
  'drawings',
  'location',
  'description',
  'notes',
  'size',
  'swatch',
  'cbm',
] as const;

export type ProposalColumnId = (typeof PROPOSAL_HIDEABLE_IDS)[number];

const PROPOSAL_COLUMN_META: Record<ProposalColumnId, { label: string; className: string }> = {
  rendering: { label: 'Rendering', className: 'w-40 min-w-40' },
  productTag: { label: 'Product Tag', className: 'min-w-36' },
  plan: { label: 'Plan', className: 'w-36 min-w-36' },
  drawings: { label: 'Drawings', className: 'min-w-36' },
  location: { label: 'Location', className: 'min-w-36' },
  description: { label: 'Product Description', className: 'min-w-64' },
  notes: { label: 'Notes', className: 'min-w-48' },
  size: { label: 'Size', className: 'w-44 min-w-44' },
  swatch: { label: 'Swatch', className: 'min-w-36' },
  cbm: { label: 'CBM', className: 'w-24 min-w-24' },
};

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;
const editInputClassName =
  'rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:outline-none';
const stickyTotalHeaderClassName = 'sticky right-10 z-40 bg-surface w-24 min-w-[96px]';
const stickyOptionsHeaderClassName = 'sticky right-0 z-40 bg-surface w-10 min-w-10';
const stickyTotalExpandedHeaderClassName =
  'sticky top-0 right-10 z-50 bg-surface w-24 min-w-[96px]';
const stickyOptionsExpandedHeaderClassName = 'sticky top-0 right-0 z-[60] bg-surface w-10 min-w-10';
const stickyTotalCellClassName =
  'sticky right-10 z-10 bg-surface w-24 min-w-[96px] group-hover:bg-neutral-50';
const stickyOptionsCellClassName =
  'sticky right-0 z-20 bg-surface w-10 min-w-10 group-hover:bg-neutral-50';
// Qty and Unit Cost sticky-right columns (always visible, not draggable).
// right offsets: unitCost = options(40) + total(96) = 136px
//               qty = unitCost(136) + unitCost-width(96) = 232px
const stickyQtyHeaderClassName = 'sticky right-[232px] z-40 bg-surface w-20 min-w-[80px]';
const stickyUnitCostHeaderClassName = 'sticky right-[136px] z-40 bg-surface w-24 min-w-[96px]';
const stickyQtyExpandedHeaderClassName =
  'sticky top-0 right-[232px] z-50 bg-surface w-20 min-w-[80px]';
const stickyUnitCostExpandedHeaderClassName =
  'sticky top-0 right-[136px] z-50 bg-surface w-24 min-w-[96px]';
const stickyQtyCellClassName =
  'sticky right-[232px] z-10 bg-surface w-20 min-w-[80px] group-hover:bg-neutral-50';
const stickyUnitCostCellClassName =
  'sticky right-[136px] z-10 bg-surface w-24 min-w-[96px] group-hover:bg-neutral-50';

// Revision sticky block — same right offsets as editable block but for revision data.
// When a revision is open the sticky block expands to show Rev Qty | Rev UC | Rev Total.
// right offsets are identical: rev-qty=232px, rev-uc=136px, rev-total=40px (right-10).
const stickyRevQtyHeaderClassName =
  'sticky right-[232px] z-40 bg-surface w-20 min-w-[80px] border-l-2 border-l-brand-300';
const stickyRevUnitCostHeaderClassName = 'sticky right-[136px] z-40 bg-surface w-24 min-w-[96px]';
const stickyRevTotalHeaderClassName = 'sticky right-10 z-40 bg-surface w-24 min-w-[96px]';
// Span header: covers all 3 revision cols (80+96+96=272px), anchored at right-10.
const stickyRevSpanHeaderClassName =
  'sticky right-10 z-40 bg-surface min-w-[272px] border-l-2 border-l-brand-300';
const stickyRevQtyExpandedHeaderClassName =
  'sticky top-0 right-[232px] z-50 bg-surface w-20 min-w-[80px] border-l-2 border-l-brand-300';
const stickyRevUnitCostExpandedHeaderClassName =
  'sticky top-0 right-[136px] z-50 bg-surface w-24 min-w-[96px]';
const stickyRevTotalExpandedHeaderClassName =
  'sticky top-0 right-10 z-50 bg-surface w-24 min-w-[96px]';
const stickyRevSpanExpandedHeaderClassName =
  'sticky top-0 right-10 z-50 bg-surface min-w-[272px] border-l-2 border-l-brand-300';
const stickyRevQtyCellClassName =
  'sticky right-[232px] z-10 bg-surface w-20 min-w-[80px] group-hover:bg-neutral-50';
const stickyRevUnitCostCellClassName =
  'sticky right-[136px] z-10 bg-surface w-24 min-w-[96px] group-hover:bg-neutral-50';
const stickyRevTotalCellClassName =
  'sticky right-10 z-10 bg-surface w-24 min-w-[96px] group-hover:bg-neutral-50';
// Locked baseline sticky block (open revision mode) — columns pinned to the LEFT of the
// revision block so baseline and revised values stay visible side-by-side.
// right offsets: notes=312(232+80), locked-total=472(312+160), locked-uc=568(472+96), locked-qty=648(568+80).
const stickyLockedQtyHeaderClassName = 'sticky right-[648px] z-40 bg-surface w-20 min-w-[80px]';
const stickyLockedUnitCostHeaderClassName =
  'sticky right-[568px] z-40 bg-surface w-24 min-w-[96px]';
const stickyLockedTotalHeaderClassName = 'sticky right-[472px] z-40 bg-surface w-24 min-w-[96px]';
const stickyNotesHeaderClassName = 'sticky right-[312px] z-40 bg-surface min-w-[160px]';
const stickyLockedQtyExpandedHeaderClassName =
  'sticky top-0 right-[648px] z-50 bg-surface w-20 min-w-[80px]';
const stickyLockedUnitCostExpandedHeaderClassName =
  'sticky top-0 right-[568px] z-50 bg-surface w-24 min-w-[96px]';
const stickyLockedTotalExpandedHeaderClassName =
  'sticky top-0 right-[472px] z-50 bg-surface w-24 min-w-[96px]';
const stickyNotesExpandedHeaderClassName =
  'sticky top-0 right-[312px] z-50 bg-surface min-w-[160px]';
const stickyLockedQtyCellClassName =
  'sticky right-[648px] z-10 bg-surface w-20 min-w-[80px] group-hover:bg-neutral-50';
const stickyLockedUnitCostCellClassName =
  'sticky right-[568px] z-10 bg-surface w-24 min-w-[96px] group-hover:bg-neutral-50';
const stickyLockedTotalCellClassName =
  'sticky right-[472px] z-10 bg-surface w-24 min-w-[96px] group-hover:bg-neutral-50';
const stickyNotesCellClassName =
  'sticky right-[312px] z-10 bg-surface min-w-[160px] group-hover:bg-neutral-50';

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

type ProposalTableProps = {
  projectId: string;
  project?: Project;
  onImport?: (() => void) | undefined;
  /** Controlled-mode: if provided, external caller manages Add Category modal open state. */
  addCategoryOpen?: boolean;
  onAddCategoryOpenChange?: (open: boolean) => void;
};

export function ProposalTable({
  projectId,
  project,
  onImport: _onImport,
  addCategoryOpen: addCategoryOpenProp,
  onAddCategoryOpenChange,
}: ProposalTableProps) {
  const { categoriesWithItems, isLoading } = useProposalWithItems(projectId);
  const createCategory = useCreateProposalCategory(projectId);
  const updateCategory = useUpdateProposalCategory(projectId);
  const deleteCategory = useDeleteProposalCategory(projectId);
  const updateItem = useUpdateProposalItem();
  const { data: customColumnDefs = [] } = useColumnDefs(projectId, 'proposal');
  const createColumnDef = useCreateColumnDef(projectId, 'proposal');
  const updateColumnDef = useUpdateColumnDef(projectId, 'proposal');
  const deleteColumnDef = useDeleteColumnDef(projectId, 'proposal');
  const columnConfig = useColumnConfig(
    projectId,
    'proposal',
    PROPOSAL_HIDEABLE_IDS,
    customColumnDefs,
  );
  const hiddenColumnDefaults = useMemo(
    () =>
      columnConfig.hiddenDefaults.map((id) => ({
        id,
        label: PROPOSAL_COLUMN_META[id as ProposalColumnId]?.label ?? id,
      })),
    [columnConfig.hiddenDefaults],
  );
  const handleColumnDragEnd = useCallback(
    (fromId: string, toId: string) => columnConfig.moveColumn(fromId, toId),
    [columnConfig],
  );
  const handleHideColumn = useCallback(
    (id: string) => columnConfig.hideDefaultColumn(id),
    [columnConfig],
  );
  const [addCategoryOpenInternal, setAddCategoryOpenInternal] = useState(false);
  const isControlledAddCategory =
    addCategoryOpenProp !== undefined && onAddCategoryOpenChange !== undefined;
  const addCategoryOpen = isControlledAddCategory
    ? (addCategoryOpenProp ?? false)
    : addCategoryOpenInternal;
  const setAddCategoryOpen = isControlledAddCategory
    ? onAddCategoryOpenChange
    : setAddCategoryOpenInternal;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<ProposalItem | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | undefined>(undefined);
  const [categoryToDelete, setCategoryToDelete] = useState<ProposalCategoryWithItems | null>(null);
  const grandTotal = proposalProjectTotalCents(categoriesWithItems);
  const totalItemCount = categoriesWithItems.reduce((sum, c) => sum + c.items.length, 0);

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="h-9 border-b border-neutral-200 bg-neutral-50" />
        <div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid h-13 grid-cols-6 items-center gap-4 border-b border-neutral-200/60 px-4"
            >
              <div className="col-span-2 h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TableViewStack>
      {categoriesWithItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <h2 className="font-display text-2xl text-neutral-900">No categories yet</h2>
            <p className="max-w-md text-sm text-neutral-600">
              Create a category to start your Proposal Table.
            </p>
          </div>
        </div>
      ) : null}

      {categoriesWithItems.map((category) => (
        <ProposalCategorySection
          key={category.id}
          projectId={projectId}
          categoryId={category.id}
          categoryName={category.name}
          items={category.items}
          otherCategories={categoriesWithItems.filter((c) => c.id !== category.id)}
          subtotalCents={proposalCategorySubtotalCents(category.items)}
          collapsed={collapsed[category.id] ?? false}
          onToggle={() => toggleCollapsed(category.id)}
          onCategoryNameSave={(name) =>
            updateCategory.mutate({ id: category.id, patch: { name: name.trim() } })
          }
          onCategoryDelete={() => setCategoryToDelete(category)}
          onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch, projectId })}
          onItemClick={(item) => {
            setSelectedItem(item);
            setSelectedCategoryName(category.name);
          }}
          visibleColOrder={columnConfig.visibleOrder}
          customColumnDefs={customColumnDefs}
          onMoveColumn={handleColumnDragEnd}
          onHideColumn={handleHideColumn}
          onRenameCustomColumn={async (defId, label) => {
            await updateColumnDef.mutateAsync({ defId, patch: { label } });
          }}
          onDeleteCustomColumn={(defId) => deleteColumnDef.mutate(defId)}
          hiddenDefaults={hiddenColumnDefaults}
          onRestoreDefault={columnConfig.restoreDefaultColumn}
          onAddCustomColumn={async (label) => {
            await createColumnDef.mutateAsync({ label, sortOrder: customColumnDefs.length });
          }}
          proposalStatus={project?.proposalStatus ?? 'in_progress'}
        />
      ))}

      <TotalsBar
        itemCount={totalItemCount}
        groupCount={categoriesWithItems.length}
        groupLabel="categories"
        grandTotal={formatMoney(cents(grandTotal))}
      />

      <AddGroupModal
        groupLabel="Category"
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        onSubmit={async (name) => {
          await createCategory.mutateAsync({ name, sortOrder: categoriesWithItems.length });
        }}
      />

      {selectedItem && (
        <ProposalItemDetailPanel
          item={selectedItem}
          categoryName={selectedCategoryName}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <DeleteCategoryModal
        open={categoryToDelete !== null}
        category={categoryToDelete}
        allCategories={categoriesWithItems}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={async (targetCategoryId) => {
          if (!categoryToDelete) return;
          if (categoryToDelete.items.length && targetCategoryId) {
            await Promise.all(
              categoryToDelete.items.map((item) =>
                updateItem.mutateAsync({
                  id: item.id,
                  patch: { categoryId: targetCategoryId, version: item.version },
                }),
              ),
            );
          }
          await deleteCategory.mutateAsync(categoryToDelete.id);
          setCategoryToDelete(null);
        }}
      />
    </TableViewStack>
  );
}

function DeleteCategoryModal({
  category,
  allCategories,
  open,
  onClose,
  onConfirm,
}: {
  category: ProposalCategoryWithItems | null;
  allCategories: ProposalCategoryWithItems[];
  open: boolean;
  onClose: () => void;
  onConfirm: (targetCategoryId: string | null) => Promise<void> | void;
}) {
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [deleteAll, setDeleteAll] = useState(false);
  const otherCategories = allCategories.filter((c) => c.id !== category?.id);
  const itemCount = category?.items.length ?? 0;
  const hasItems = itemCount > 0;
  const canDelete = !hasItems || deleteAll || targetCategoryId.length > 0;

  useEffect(() => {
    if (open) {
      setTargetCategoryId('');
      setDeleteAll(false);
    }
  }, [open, category?.id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `Delete ${category.name}?` : 'Delete category'}
    >
      <div className="flex flex-col gap-4">
        {hasItems ? (
          <>
            <p className="text-sm text-gray-600">
              <strong>{category?.name}</strong> has {itemCount} {itemCount === 1 ? 'item' : 'items'}
              . Choose what to do with them before deleting.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/30">
                <input
                  type="radio"
                  name="delete-category-action"
                  className="mt-0.5 accent-brand-500"
                  checked={!deleteAll}
                  onChange={() => setDeleteAll(false)}
                />
                <span className="text-sm font-medium text-gray-800">
                  Move items to another category
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 has-[:checked]:border-danger-500 has-[:checked]:bg-danger-500/5">
                <input
                  type="radio"
                  name="delete-category-action"
                  className="mt-0.5 accent-brand-500"
                  checked={deleteAll}
                  onChange={() => setDeleteAll(true)}
                />
                <span className="text-sm font-medium text-gray-800">
                  Delete category and all {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </label>
            </div>
            {!deleteAll && (
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Move items to...
                <select
                  value={targetCategoryId}
                  onChange={(event) => setTargetCategoryId(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Choose a category</option>
                  {otherCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-600">This category is empty and can be deleted.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canDelete}
            onClick={() => {
              void Promise.resolve(
                onConfirm(hasItems && !deleteAll ? targetCategoryId : null),
              ).then(() => {
                setTargetCategoryId('');
                setDeleteAll(false);
                onClose();
              });
            }}
          >
            Delete category
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ChevronIcon({ direction = 'down' }: { direction?: 'down' | 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        'h-4 w-4 transition-transform',
        direction === 'left' && 'rotate-90',
        direction === 'right' && '-rotate-90',
      )}
    >
      <path
        d="m5.5 8 4.5 4.5L14.5 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function ExpandIcon({ expanded }: { expanded?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      {expanded ? (
        <path
          d="M7.5 4.5v4h-4m9 7v-4h4M7.5 8.5 3.5 4.5m9 7 4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 4H4v4m8-4h4v4M8 16H4v-4m8 4h4v-4M4.5 4.5 8 8m7.5-3.5L12 8m-7.5 7.5L8 12m7.5 3.5L12 12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const menuItemClassName =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

function CategoryActionsMenu({
  categoryName,
  hiddenDefaults,
  onCategoryDelete,
  onAddItem,
  onRestoreDefault,
  onOpenAddColumnModal,
}: {
  categoryName: string;
  hiddenDefaults: { id: string; label: string }[];
  onCategoryDelete: () => void;
  onAddItem: () => void;
  onRestoreDefault: (id: string) => void;
  onOpenAddColumnModal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [columnSubmenuOpen, setColumnSubmenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const columnTriggerRef = useRef<HTMLButtonElement>(null);
  const columnSubmenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      const inSubmenu = columnSubmenuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu && !inSubmenu) {
        setOpen(false);
        setColumnSubmenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open options for ${categoryName}`}
        title={`Open options for ${categoryName}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
            className="z-[100] min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onAddItem)}
            >
              Add item
            </button>
            <div className="relative">
              <button
                ref={columnTriggerRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={columnSubmenuOpen}
                className={cn(menuItemClassName, 'justify-between')}
                onClick={() => setColumnSubmenuOpen((v) => !v)}
              >
                Add column
                <ChevronIcon direction="right" />
              </button>
              {columnSubmenuOpen &&
                columnTriggerRef.current &&
                createPortal(
                  <div
                    ref={columnSubmenuRef}
                    role="menu"
                    style={{
                      position: 'fixed',
                      top: columnTriggerRef.current.getBoundingClientRect().top,
                      right:
                        window.innerWidth -
                        columnTriggerRef.current.getBoundingClientRect().left +
                        4,
                    }}
                    className="z-[100] min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                  >
                    {hiddenDefaults.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        role="menuitem"
                        className={menuItemClassName}
                        onClick={() => {
                          setColumnSubmenuOpen(false);
                          setOpen(false);
                          onRestoreDefault(col.id);
                        }}
                      >
                        {col.label}
                      </button>
                    ))}
                    {hiddenDefaults.length > 0 && <div className="my-1 h-px bg-gray-100" />}
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClassName}
                      onClick={() => {
                        setColumnSubmenuOpen(false);
                        setOpen(false);
                        onOpenAddColumnModal();
                      }}
                    >
                      Add custom column...
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              role="menuitem"
              className={cn(menuItemClassName, 'text-danger-600')}
              onClick={() => runAction(onCategoryDelete)}
            >
              Delete category
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ProposalCategorySection({
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
}: {
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
}) {
  const createItem = useCreateProposalItem(categoryId);
  const deleteItem = useDeleteProposalItem(categoryId);
  const moveItem = useMoveProposalItem();
  const updateItem = useUpdateProposalItem();
  const isMobile = useIsMobileViewport();
  const { data: revisionsData } = useProposalRevisions(projectId);
  const revisions = useMemo(() => revisionsData?.revisions ?? [], [revisionsData]);
  const snapshotsByRevThenItem = useMemo(() => {
    const map = new Map<string, Map<string, RevisionSnapshot>>();
    for (const snap of revisionsData?.snapshots ?? []) {
      if (!map.has(snap.revisionId)) map.set(snap.revisionId, new Map());
      map.get(snap.revisionId)!.set(snap.itemId, snap);
    }
    return map;
  }, [revisionsData?.snapshots]);

  // Derive open revision and per-item changelog for the Notes column.
  const openRev = useMemo(() => revisions.find((r) => r.closedAt === null) ?? null, [revisions]);
  const hasOpenRevision = openRev !== null;
  const changelogByItemId = useMemo(() => {
    const map = new Map<string, ProposalItemChangelogEntry[]>();
    if (!openRev) return map;
    for (const entry of revisionsData?.changelog ?? []) {
      if (entry.revisionId !== openRev.id) continue;
      if (!map.has(entry.proposalItemId)) map.set(entry.proposalItemId, []);
      map.get(entry.proposalItemId)!.push(entry);
    }
    return map;
  }, [revisionsData?.changelog, openRev]);

  type PendingChange = ChangeInfo & {
    item: ProposalItem;
    patch: Omit<UpdateProposalItemInput, 'version'>;
  };
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  function handleItemSave(item: ProposalItem, patch: Omit<UpdateProposalItemInput, 'version'>) {
    // Normal in_progress (no open revision): direct save, no changelog.
    if (proposalStatus === 'in_progress' && !hasOpenRevision) {
      onItemSave(item, { ...patch, version: item.version });
      return;
    }
    const changeInfo = patchToChangeInfo(patch, item, customColumnDefs);
    if (!changeInfo) {
      onItemSave(item, { ...patch, version: item.version });
      return;
    }
    // Quantity change during open revision (in_progress): send changeLog immediately
    // without showing the modal. The API routes the new qty to the revision snapshot
    // and flags cost_status so the PM can review the revised total.
    // proposal_items.quantity stays locked as the baseline reference value.
    if (
      proposalStatus === 'in_progress' &&
      hasOpenRevision &&
      changeInfo.columnKey === 'quantity'
    ) {
      onItemSave(item, {
        ...patch,
        version: item.version,
        changeLog: {
          columnKey: changeInfo.columnKey,
          previousValue: changeInfo.previousValue,
          newValue: changeInfo.newValue,
          proposalStatus,
          isPriceAffecting: true,
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
    const fullPatch: UpdateProposalItemInput = {
      ...patch,
      version: item.version,
      changeLog,
    };
    onItemSave(item, fullPatch);
    setPendingChange(null);
  }
  const [isExpanded, setIsExpanded] = useState(false);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  const draggableColOrder = useMemo(
    () => visibleColOrder.filter((id) => !STICKY_RIGHT_COLUMN_IDS.has(id)),
    [visibleColOrder],
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
  const handleRowDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
      const newIndex = sortedItems.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sortedItems, oldIndex, newIndex);
      const patches = reordered
        .map((item, sortOrder) => ({ item, sortOrder }))
        .filter(({ item, sortOrder }) => item.sortOrder !== sortOrder);
      void (async () => {
        for (const { item, sortOrder } of patches) {
          await updateItem.mutateAsync({
            id: item.id,
            patch: { sortOrder, version: item.version },
          });
        }
      })();
    },
    [sortedItems, updateItem],
  );
  const itemCount = items.length;

  return (
    <GroupedTableSection>
      <GroupedTableHeader className="flex-wrap gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
            title={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
            className="shrink-0 rounded px-1 text-xs text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronIcon direction={collapsed ? 'right' : 'down'} />
          </button>
          <InlineTextEdit
            value={categoryName}
            onSave={(name) => {
              onCategoryNameSave(name);
            }}
            aria-label="Category name"
            renderDisplay={(v) => (
              <span className="truncate text-sm font-semibold text-gray-950">{v}</span>
            )}
            inputClassName="text-sm font-semibold text-gray-950 border-gray-300 bg-white"
          />
          <span className="shrink-0 rounded-pill bg-white px-2 py-0.5 text-xs text-gray-600">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
            {formatMoney(cents(subtotalCents))}
          </span>
          <CategoryActionsMenu
            categoryName={categoryName}
            hiddenDefaults={hiddenDefaults}
            onCategoryDelete={onCategoryDelete}
            onAddItem={() =>
              createItem.mutate({
                sortOrder: items.length,
                productTag: `${categoryName.slice(0, 2).toUpperCase()}-${items.length + 1}`,
              })
            }
            onRestoreDefault={onRestoreDefault}
            onOpenAddColumnModal={() => setAddColumnModalOpen(true)}
          />
          {!collapsed && (
            <button
              type="button"
              aria-label="Expand table view"
              title="Expand table view"
              onClick={() => setIsExpanded(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <ExpandIcon />
            </button>
          )}
        </div>
      </GroupedTableHeader>

      {!collapsed && !isMobile && (
        <div className="overflow-x-auto">
          <table
            className={cn(
              hasOpenRevision ? 'min-w-[1600px]' : 'min-w-[1320px]',
              'w-full border-collapse text-left text-sm',
            )}
          >
            <thead className="sticky top-0 z-30 bg-surface text-xs">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}
              >
                <tr>
                  <th
                    className="h-10 border-y border-neutral-200 w-8 min-w-8 px-1"
                    rowSpan={hasOpenRevision ? 2 : 1}
                  />
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
                            rowSpan={hasOpenRevision ? 2 : 1}
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface',
                              meta.className,
                            )}
                            onHide={() => onHideColumn(colId)}
                          />
                        );
                      }
                      const customDef = customColumnDefs.find((d) => d.id === colId);
                      if (!customDef) return null;
                      return (
                        <SortableColHeader
                          key={colId}
                          colId={colId}
                          rowSpan={hasOpenRevision ? 2 : 1}
                          className="h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface min-w-36"
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
                      {/* Locked baseline cols (sticky, left of revision block) */}
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyLockedQtyHeaderClassName,
                        )}
                        rowSpan={2}
                      >
                        Qty
                      </th>
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyLockedUnitCostHeaderClassName,
                        )}
                        rowSpan={2}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyLockedTotalHeaderClassName,
                        )}
                        rowSpan={2}
                      >
                        Total
                      </th>
                      {/* Revision notes (sticky, between locked and revision blocks) */}
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyNotesHeaderClassName,
                        )}
                        rowSpan={2}
                      >
                        Notes
                      </th>
                      {/* Revision span header (sticky) */}
                      <th
                        colSpan={3}
                        className={cn(
                          'h-5 border-t border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-brand-600',
                          stickyRevSpanHeaderClassName,
                        )}
                      >
                        Revision {openRev?.label}
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyQtyHeaderClassName,
                        )}
                      >
                        Qty
                      </th>
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyUnitCostHeaderClassName,
                        )}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                          stickyTotalHeaderClassName,
                        )}
                      >
                        Total Cost
                      </th>
                    </>
                  )}
                  <th
                    className={cn('h-10 border-y border-neutral-200', stickyOptionsHeaderClassName)}
                    rowSpan={hasOpenRevision ? 2 : 1}
                  />
                </tr>
                {hasOpenRevision && (
                  <tr>
                    {/* Revision sub-headers — all other columns are rowSpan=2 */}
                    <th
                      className={cn(
                        'h-5 border-b border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-400',
                        stickyRevQtyHeaderClassName,
                      )}
                    >
                      Qty
                    </th>
                    <th
                      className={cn(
                        'h-5 border-b border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-400',
                        stickyRevUnitCostHeaderClassName,
                      )}
                    >
                      Cost
                    </th>
                    <th
                      className={cn(
                        'h-5 border-b border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-400',
                        stickyRevTotalHeaderClassName,
                      )}
                    >
                      Total
                    </th>
                  </tr>
                )}
              </DndContext>
            </thead>
            <tbody>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRowDragEnd}
              >
                <SortableContext
                  items={sortedItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedItems.map((item) => (
                    <ProposalRow
                      key={item.id}
                      projectId={projectId}
                      categoryId={categoryId}
                      item={item}
                      otherCategories={otherCategories}
                      onSave={(patch) => handleItemSave(item, patch)}
                      onDelete={() => deleteItem.mutate(item.id)}
                      onDuplicate={() =>
                        createItem.mutate({
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
                          ...(Object.keys(item.customData).length > 0 && {
                            customData: item.customData,
                          }),
                        })
                      }
                      onMove={(toCategoryId) =>
                        moveItem.mutate({
                          id: item.id,
                          fromCategoryId: categoryId,
                          toCategoryId,
                          version: item.version,
                        })
                      }
                      onRowClick={() => onItemClick(item)}
                      visibleColOrder={visibleColOrder}
                      customColumnDefs={customColumnDefs}
                      proposalStatus={proposalStatus}
                      revisions={revisions}
                      snapshotMap={snapshotsByRevThenItem}
                      openRev={openRev}
                      changelogByItemId={changelogByItemId}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>
        </div>
      )}

      {!collapsed && isMobile && (
        <div className="p-3">
          <MobileProposalCards
            items={sortedItems}
            otherCategories={otherCategories}
            onDelete={(item) => deleteItem.mutate(item.id)}
            onDuplicate={(item) =>
              createItem.mutate({
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
              })
            }
            onMove={(item, toCategoryId) =>
              moveItem.mutate({
                id: item.id,
                fromCategoryId: categoryId,
                toCategoryId,
                version: item.version,
              })
            }
            onItemClick={onItemClick}
          />
        </div>
      )}

      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-gray-950/35 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-surface px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-950">{categoryName}</h2>
                <p className="text-xs text-gray-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} -{' '}
                  {formatMoney(cents(subtotalCents))}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Minimize table view"
                title="Minimize table view"
                onClick={() => setIsExpanded(false)}
              >
                <ExpandIcon expanded />
                Minimize
              </Button>
            </div>
            <div
              tabIndex={0}
              aria-label={`${categoryName} expanded items table`}
              className="min-w-0 overflow-auto flex-1"
            >
              <table
                className={cn(
                  hasOpenRevision ? 'min-w-[1600px]' : 'min-w-[1320px]',
                  'w-full border-collapse text-left text-sm',
                )}
              >
                <thead className="sticky top-0 z-30 bg-surface text-xs">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleColumnDragEnd}
                  >
                    <tr>
                      <th
                        className="h-10 border-y border-neutral-200 w-8 min-w-8 px-1"
                        rowSpan={hasOpenRevision ? 2 : 1}
                      />
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
                                rowSpan={hasOpenRevision ? 2 : 1}
                                className={cn(
                                  'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface',
                                  meta.className,
                                )}
                                onHide={() => onHideColumn(colId)}
                              />
                            );
                          }
                          const customDef = customColumnDefs.find((d) => d.id === colId);
                          if (!customDef) return null;
                          return (
                            <SortableColHeader
                              key={colId}
                              colId={colId}
                              rowSpan={hasOpenRevision ? 2 : 1}
                              className="h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface min-w-36"
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
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyLockedQtyExpandedHeaderClassName,
                            )}
                            rowSpan={2}
                          >
                            Qty
                          </th>
                          <th
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyLockedUnitCostExpandedHeaderClassName,
                            )}
                            rowSpan={2}
                          >
                            Unit Cost
                          </th>
                          <th
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyLockedTotalExpandedHeaderClassName,
                            )}
                            rowSpan={2}
                          >
                            Total
                          </th>
                          <th
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyNotesExpandedHeaderClassName,
                            )}
                            rowSpan={2}
                          >
                            Notes
                          </th>
                          <th
                            colSpan={3}
                            className={cn(
                              'h-5 border-t border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-brand-600',
                              stickyRevSpanExpandedHeaderClassName,
                            )}
                          >
                            Revision {openRev?.label}
                          </th>
                        </>
                      ) : (
                        <>
                          <th
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyQtyExpandedHeaderClassName,
                            )}
                          >
                            Qty
                          </th>
                          <th
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyUnitCostExpandedHeaderClassName,
                            )}
                          >
                            Unit Cost
                          </th>
                          <th
                            className={cn(
                              'h-10 border-y border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-500',
                              stickyTotalExpandedHeaderClassName,
                            )}
                          >
                            Total Cost
                          </th>
                        </>
                      )}
                      <th
                        className={cn(
                          'h-10 border-y border-neutral-200',
                          stickyOptionsExpandedHeaderClassName,
                        )}
                        rowSpan={hasOpenRevision ? 2 : 1}
                      />
                    </tr>
                    {hasOpenRevision && (
                      <tr>
                        {/* Revision sub-headers — all other columns are rowSpan=2 */}
                        <th
                          className={cn(
                            'h-5 border-b border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-400',
                            stickyRevQtyExpandedHeaderClassName,
                          )}
                        >
                          Qty
                        </th>
                        <th
                          className={cn(
                            'h-5 border-b border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-400',
                            stickyRevUnitCostExpandedHeaderClassName,
                          )}
                        >
                          Cost
                        </th>
                        <th
                          className={cn(
                            'h-5 border-b border-neutral-200 px-3 font-medium uppercase tracking-[0.08em] text-neutral-400',
                            stickyRevTotalExpandedHeaderClassName,
                          )}
                        >
                          Total
                        </th>
                      </tr>
                    )}
                  </DndContext>
                </thead>
                <tbody>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleRowDragEnd}
                  >
                    <SortableContext
                      items={sortedItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortedItems.map((item) => (
                        <ProposalRow
                          key={item.id}
                          projectId={projectId}
                          categoryId={categoryId}
                          item={item}
                          otherCategories={otherCategories}
                          onSave={(patch) => handleItemSave(item, patch)}
                          onDelete={() => deleteItem.mutate(item.id)}
                          onDuplicate={() =>
                            createItem.mutate({
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
                              ...(Object.keys(item.customData).length > 0 && {
                                customData: item.customData,
                              }),
                            })
                          }
                          onMove={(toCategoryId) =>
                            moveItem.mutate({
                              id: item.id,
                              fromCategoryId: categoryId,
                              toCategoryId,
                              version: item.version,
                            })
                          }
                          onRowClick={() => onItemClick(item)}
                          visibleColOrder={visibleColOrder}
                          customColumnDefs={customColumnDefs}
                          proposalStatus={proposalStatus}
                          revisions={revisions}
                          snapshotMap={snapshotsByRevThenItem}
                          openRev={openRev}
                          changelogByItemId={changelogByItemId}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
          onConfirm={handleConfirm}
          onCancel={() => setPendingChange(null)}
        />
      )}
    </GroupedTableSection>
  );
}

function ProposalRow({
  projectId,
  categoryId,
  item,
  otherCategories,
  onSave,
  onDelete,
  onDuplicate,
  onMove,
  onRowClick,
  visibleColOrder,
  customColumnDefs,
  proposalStatus,
  revisions,
  snapshotMap,
  openRev,
  changelogByItemId,
}: {
  projectId: string;
  categoryId: string;
  item: ProposalItem;
  otherCategories: { id: string; name: string }[];
  onSave: (patch: Omit<UpdateProposalItemInput, 'version'>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (toCategoryId: string) => void;
  onRowClick: () => void;
  visibleColOrder: string[];
  customColumnDefs: CustomColumnDef[];
  proposalStatus: ProposalStatus;
  revisions: ProposalRevision[];
  snapshotMap: Map<string, Map<string, RevisionSnapshot>>;
  openRev: ProposalRevision | null;
  changelogByItemId: Map<string, ProposalItemChangelogEntry[]>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [sizeOpen, setSizeOpen] = useState(false);
  const [swatchOpen, setSwatchOpen] = useState(false);
  const lineTotal = proposalLineTotalCents(item);
  const stopProp = (e: MouseEvent) => e.stopPropagation();

  const showDots = proposalStatus !== 'in_progress';
  const dot = (columnKey: string) =>
    showDots ? (
      <ChangeHistoryDot itemId={item.id} columnKey={columnKey} revisions={revisions} />
    ) : null;

  const cellRenderMap: Record<string, ReactNode> = {
    rendering: (
      <td className="w-40 min-w-40 px-3 py-2" onClick={stopProp}>
        <ImageFrame
          entityType="proposal_item"
          entityId={item.id}
          alt={`${item.productTag || 'Proposal'} rendering`}
          className="h-20 w-[125px] max-w-full"
          compact
        />
      </td>
    ),
    productTag: (
      <EditableCell
        value={item.productTag}
        onSave={(productTag) => onSave({ productTag })}
        indicator={dot('productTag')}
      />
    ),
    plan: (
      <td className="w-36 min-w-36 px-3 py-2" onClick={stopProp}>
        <ImageFrame
          entityType="proposal_plan"
          entityId={item.id}
          alt={`${item.productTag || 'Proposal'} plan`}
          className="h-20 w-[110px] max-w-full"
          compact
        />
      </td>
    ),
    drawings: (
      <EditableCell
        value={item.drawings}
        onSave={(drawings) => onSave({ drawings })}
        indicator={dot('drawings')}
      />
    ),
    location: (
      <EditableCell
        value={item.location}
        onSave={(location) => onSave({ location })}
        indicator={dot('location')}
      />
    ),
    description: (
      <EditableCell
        value={item.description}
        onSave={(description) => onSave({ description })}
        className="min-w-64"
        indicator={dot('description')}
      />
    ),
    notes: (
      <EditableCell
        value={item.notes}
        onSave={(notes) => onSave({ notes })}
        className="min-w-48"
        indicator={dot('notes')}
      />
    ),
    size: (
      <td className="px-3 py-2" onClick={stopProp}>
        <div className="flex items-start justify-between gap-1">
          <button
            type="button"
            onClick={() => setSizeOpen(true)}
            className={cn(
              'min-h-9 w-40 rounded text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
              item.sizeLabel
                ? 'px-2 py-1 text-gray-700 hover:bg-brand-50'
                : 'border border-gray-300 px-2 py-1 text-gray-400 hover:border-brand-500',
            )}
          >
            {item.sizeLabel || 'Set size'}
          </button>
          {dot('size')}
        </div>
        <SizeModal
          item={item}
          open={sizeOpen}
          onClose={() => setSizeOpen(false)}
          onSave={(patch) => {
            onSave(patch);
            setSizeOpen(false);
          }}
        />
      </td>
    ),
    swatch: (
      <td className="min-w-36 px-3 py-2" onClick={stopProp}>
        <MaterialBadges materials={item.materials} onOpen={() => setSwatchOpen(true)} />
        <MaterialLibraryModal
          open={swatchOpen}
          projectId={projectId}
          context="proposal"
          categoryId={categoryId}
          item={item}
          onClose={() => setSwatchOpen(false)}
        />
      </td>
    ),
    cbm: (
      <NumberCell
        value={item.cbm}
        step="0.001"
        onSave={(cbm) => onSave({ cbm })}
        className="w-24"
        indicator={dot('cbm')}
      />
    ),
    // quantity and unitCost are rendered as fixed sticky-right cells below.
    ...Object.fromEntries(
      customColumnDefs.map((def) => [
        def.id,
        <EditableCell
          value={item.customData[def.id] ?? ''}
          onSave={(value) => {
            onSave({ customData: { ...item.customData, [def.id]: value } });
          }}
          indicator={dot(def.id)}
        />,
      ]),
    ),
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border-b border-neutral-200/60 align-top last:border-b-0',
        isDragging && 'bg-brand-50 shadow-md opacity-80',
      )}
    >
      <td className="w-8 min-w-8 px-1 py-2" onClick={stopProp}>
        <button
          type="button"
          aria-label={`Drag ${item.productTag || 'item'}`}
          className="cursor-grab rounded px-1 text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      </td>
      {visibleColOrder.map((colId) => (
        <Fragment key={colId}>{cellRenderMap[colId]}</Fragment>
      ))}
      {openRev ? (
        (() => {
          const snap = snapshotMap.get(openRev.id)?.get(item.id);
          const revEntries = changelogByItemId.get(item.id) ?? [];
          return (
            <>
              {/* Locked baseline: qty/UC/Total are all read-only reference values */}
              <td
                className={cn(
                  'px-3 py-2 text-sm tabular-nums text-neutral-400',
                  stickyLockedQtyCellClassName,
                )}
              >
                {item.quantity} {item.quantityUnit}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-sm tabular-nums text-neutral-400',
                  stickyLockedUnitCostCellClassName,
                )}
              >
                {formatMoney(cents(item.unitCostCents))}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-sm tabular-nums text-neutral-400',
                  stickyLockedTotalCellClassName,
                )}
              >
                {formatMoney(cents(lineTotal))}
              </td>
              {/* Revision notes: sticky, between locked and revision blocks */}
              <RevisionNotesCell entries={revEntries} tdClassName={stickyNotesCellClassName} />
              {/* Revision snapshot cells (sticky) */}
              <RevisionQtyCell
                snapshot={snap}
                currentQuantity={item.quantity}
                currentUnit={item.quantityUnit}
                onSaveQuantity={(quantity) => onSave({ quantity })}
                tdClassName={stickyRevQtyCellClassName}
              />
              <RevisionCostCell
                snapshot={snap}
                projectId={projectId}
                revisionId={openRev.id}
                itemId={item.id}
                tdClassName={stickyRevUnitCostCellClassName}
              />
              <RevisionTotalCell snapshot={snap} tdClassName={stickyRevTotalCellClassName} />
            </>
          );
        })()
      ) : (
        <>
          <QuantityCell
            quantity={item.quantity}
            quantityUnit={item.quantityUnit}
            onSaveQuantity={(quantity) => onSave({ quantity })}
            onSaveUnit={(quantityUnit) => onSave({ quantityUnit })}
            indicator={dot('quantity')}
            tdClassName={stickyQtyCellClassName}
          />
          <MoneyCell
            valueCents={item.unitCostCents}
            onSave={(unitCostCents) => onSave({ unitCostCents })}
            indicator={dot('unitCostCents')}
            tdClassName={stickyUnitCostCellClassName}
          />
          <td className={cn('px-3 py-2 font-semibold text-gray-900', stickyTotalCellClassName)}>
            {formatMoney(cents(lineTotal))}
          </td>
        </>
      )}
      <td className={cn('px-1 py-2', stickyOptionsCellClassName)} onClick={stopProp}>
        <ProposalItemActionsMenu
          itemName={item.productTag || item.description || 'item'}
          otherCategories={otherCategories}
          onViewDetails={onRowClick}
          onDuplicate={onDuplicate}
          onMove={onMove}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function ProposalItemActionsMenu({
  itemName,
  otherCategories,
  onViewDetails,
  onDuplicate,
  onMove,
  onDelete,
}: {
  itemName: string;
  otherCategories: { id: string; name: string }[];
  onViewDetails: () => void;
  onDuplicate: () => void;
  onMove: (toCategoryId: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moveTriggerRef = useRef<HTMLButtonElement>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(event.target as Node) ?? false;
      const inMoveMenu = moveMenuRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inMenu && !inMoveMenu) {
        setOpen(false);
        setMoveOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    setMoveOpen(false);
    action();
  };

  const menuRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open options for ${itemName}`}
        title={`Open options for ${itemName}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreIcon />
      </button>
      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuRect.bottom + 4,
              right: window.innerWidth - menuRect.right,
            }}
            className="z-[100] min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onViewDetails)}
            >
              View details
            </button>
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onDuplicate)}
            >
              Duplicate
            </button>
            {otherCategories.length > 0 && (
              <div className="relative">
                <button
                  ref={moveTriggerRef}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={moveOpen}
                  className={menuItemClassName}
                  onClick={() => setMoveOpen((v) => !v)}
                >
                  Move to...
                  <span className="ml-auto text-xs text-gray-400">{'>'}</span>
                </button>
                {moveOpen &&
                  moveTriggerRef.current &&
                  createPortal(
                    <div
                      ref={moveMenuRef}
                      role="menu"
                      style={{
                        position: 'fixed',
                        top: moveTriggerRef.current.getBoundingClientRect().top,
                        right:
                          window.innerWidth -
                          moveTriggerRef.current.getBoundingClientRect().left +
                          4,
                      }}
                      className="z-[100] min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                    >
                      {otherCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          role="menuitem"
                          className={menuItemClassName}
                          onClick={() => runAction(() => onMove(cat.id))}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )}
              </div>
            )}
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              role="menuitem"
              className={cn(menuItemClassName, 'text-danger-600')}
              onClick={() => runAction(onDelete)}
            >
              Delete item
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MobileProposalCards({
  items,
  otherCategories,
  onDelete,
  onDuplicate,
  onMove,
  onItemClick,
}: {
  items: ProposalItem[];
  otherCategories: { id: string; name: string }[];
  onDelete: (item: ProposalItem) => void;
  onDuplicate: (item: ProposalItem) => void;
  onMove: (item: ProposalItem, toCategoryId: string) => void;
  onItemClick: (item: ProposalItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
        Add first item -&gt;
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const lineTotal = proposalLineTotalCents(item);
        return (
          <article
            key={item.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ImageFrame
                  entityType="proposal_item"
                  entityId={item.id}
                  alt={item.productTag || 'item'}
                  fallbackUrl={null}
                  className="h-14 aspect-[117/75] shrink-0"
                  compact
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    className="truncate text-base font-semibold text-gray-950 hover:underline text-left"
                  >
                    {item.productTag || item.description || 'Unnamed item'}
                  </button>
                  {item.location && (
                    <p className="mt-0.5 truncate text-sm text-gray-500">{item.location}</p>
                  )}
                </div>
              </div>
              <ProposalItemActionsMenu
                itemName={item.productTag || item.description || 'item'}
                otherCategories={otherCategories}
                onViewDetails={() => onItemClick(item)}
                onDuplicate={() => onDuplicate(item)}
                onMove={(toCategoryId) => onMove(item, toCategoryId)}
                onDelete={() => onDelete(item)}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MobileField label="Quantity">
                <span>
                  {item.quantity} {item.quantityUnit}
                </span>
              </MobileField>
              <MobileField label="Unit Cost">
                <span>{formatMoney(cents(item.unitCostCents))}</span>
              </MobileField>
              <MobileField label="Total">
                <span className="font-semibold tabular-nums">{formatMoney(cents(lineTotal))}</span>
              </MobileField>
              {item.sizeLabel && (
                <MobileField label="Size">
                  <span>{item.sizeLabel}</span>
                </MobileField>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-1 text-gray-950">{children}</div>
    </div>
  );
}

function EditableCell({
  value,
  onSave,
  className,
  indicator,
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  indicator?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    const isEmpty = !value;
    return (
      <td className={cn('px-3 py-2', className)} onClick={(e) => e.stopPropagation()}>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block w-full cursor-pointer rounded px-2 py-1 text-sm',
            isEmpty
              ? 'border border-gray-300 text-gray-400 hover:border-brand-500'
              : 'text-gray-700 hover:bg-brand-50',
          )}
        >
          {isEmpty ? '-' : value}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', className)} onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn('w-full', editInputClassName)}
      />
    </td>
  );
}

function NumberCell({
  value,
  onSave,
  step,
  className,
  indicator,
}: {
  value: number;
  onSave: (value: number) => void;
  step: string;
  className?: string;
  indicator?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0 && n !== value) onSave(n);
    setEditing(false);
  };

  if (!editing) {
    return (
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50',
            className,
          )}
        >
          {value}
        </span>
      </td>
    );
  }

  return (
    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="number"
        min="0"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={cn(editInputClassName, className)}
      />
    </td>
  );
}

function MoneyCell({
  valueCents,
  onSave,
  indicator,
  tdClassName,
}: {
  valueCents: number;
  onSave: (value: number) => void;
  indicator?: ReactNode;
  tdClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((valueCents / 100).toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft((valueCents / 100).toString());
  }, [valueCents, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const dollars = parseUnitCostDollarsInput(draft);
    if (dollars !== undefined) {
      const newCents = dollarsToCents(dollars);
      if (newCents !== valueCents) onSave(newCents);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <td className={cn('px-3 py-2', tdClassName)} onClick={(e) => e.stopPropagation()}>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className="block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50"
        >
          {formatMoney(cents(valueCents))}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', tdClassName)} onClick={(e) => e.stopPropagation()}>
      <div className="relative w-28">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-gray-400">
          $
        </span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft((valueCents / 100).toString());
              setEditing(false);
            }
          }}
          className={cn('w-full py-1 pl-5 pr-2', editInputClassName)}
        />
      </div>
    </td>
  );
}

function QuantityCell({
  quantity,
  quantityUnit,
  onSaveQuantity,
  onSaveUnit,
  indicator,
  tdClassName,
}: {
  quantity: number;
  quantityUnit: string;
  onSaveQuantity: (value: number) => void;
  onSaveUnit: (value: string) => void;
  indicator?: ReactNode;
  tdClassName?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <td className={cn('px-3 py-2', tdClassName)} onClick={(e) => e.stopPropagation()}>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className="block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50"
        >
          {quantity} {quantityUnit}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', tdClassName)} onClick={(e) => e.stopPropagation()}>
      <div
        className="flex flex-col gap-1"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setEditing(false);
          }
        }}
      >
        <input
          type="number"
          min="0"
          step="0.01"
          defaultValue={quantity}
          autoFocus
          onChange={(event) => onNumberChange(event, onSaveQuantity)}
          className={cn('w-20', editInputClassName)}
          aria-label="Quantity"
        />
        <select
          value={quantityUnit}
          onChange={(event) => onSaveUnit(event.target.value)}
          className={cn('w-20', editInputClassName)}
          aria-label="Quantity unit"
        >
          {quantityUnits.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>
    </td>
  );
}

function SizeModal({
  item,
  open,
  onClose,
  onSave,
}: {
  item: ProposalItem;
  open: boolean;
  onClose: () => void;
  onSave: (patch: Omit<UpdateProposalItemInput, 'version'>) => void;
}) {
  return (
    <DimensionEditorModal
      open={open}
      title="Set size"
      initial={{
        mode: item.sizeMode,
        unit: item.sizeUnit,
        w: item.sizeW,
        d: item.sizeD,
        h: item.sizeH,
      }}
      onClose={onClose}
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
    />
  );
}

function onNumberChange(event: ChangeEvent<HTMLInputElement>, onSave: (value: number) => void) {
  const value = Number(event.target.value);
  if (Number.isFinite(value) && value >= 0) onSave(value);
}
