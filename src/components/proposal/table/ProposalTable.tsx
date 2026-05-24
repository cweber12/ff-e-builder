import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { toast } from '../../primitives/toast-api';
import { TotalsBar } from '../../shared/table/TotalsBar';
import { ProposalItemDetailPanel } from './ProposalItemDetailPanel';
import { ImageFrame } from '../../shared/image/ImageFrame';
import {
  useCreateProposalCategory,
  useCreateProposalItem,
  useDeleteProposalCategory,
  useDeleteProposalItem,
  useAddProposalItemToFfe,
  useMoveProposalItem,
  useProposalWithItems,
  useUpdateProposalCategory,
  useUpdateProposalItem,
  useColumnConfig,
  useColumnDefs,
  useCreateColumnDef,
  useUpdateColumnDef,
  useDeleteColumnDef,
  useIsMobileViewport,
  useProposalRevisions,
} from '../../../hooks';
import { MaterialLibraryModal } from '../../materials';
import {
  cents,
  formatMoney,
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
import {
  ColumnNavArrows,
  GroupedTableHeader,
  GroupedTableSection,
  MobileField,
  TableViewStack,
} from '../../shared/table/TableViewWrappers';
import { AddGroupModal } from '../../shared/modals/AddGroupModal';
import { SortableColHeader } from '../../shared/table/SortableColHeader';
import { CustomColumnHeader } from '../../shared/table/CustomColumnHeader';
import { GeneratedItemActionTrigger } from '../../shared/table/GeneratedItemActionControls';
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
import { AddColumnModal } from '../../shared/modals/AddColumnModal';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/utils';
import {
  proposalPatchToGeneratedItemChangeInfo,
  type GeneratedItemChangeInfo,
} from '../../../lib/table/generatedItemChangeInfo';
import { PROPOSAL_GENERATED_ITEM_TABLE_PRESET } from '../../../lib/table/generatedItemTablePresets';
import {
  ChangeConfirmModal,
  type ChangeConfirmResult,
} from '../../shared/modals/ChangeConfirmModal';
import {
  RevisionCostCell,
  GeneratedItemColumnChangeDot,
  RevisionNotesCell,
  RevisionQtyCell,
  RevisionTotalCell,
} from '../revision';

// --- Proposal Status ---

// --- Proposal Table Column Definitions ---
// quantity and unitCost are fixed sticky-right columns — not draggable or hideable.
const STICKY_RIGHT_COLUMN_IDS = new Set<string>(
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET.fixedColumnIds,
);

const PROPOSAL_HIDEABLE_IDS = PROPOSAL_GENERATED_ITEM_TABLE_PRESET.hideableColumnIds;

export type ProposalColumnId = (typeof PROPOSAL_HIDEABLE_IDS)[number];

const PROPOSAL_COLUMN_META = PROPOSAL_GENERATED_ITEM_TABLE_PRESET.columnMeta;

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;
const editInputClassName =
  'rounded-sm border border-black/15 bg-canvas-chrome px-2 py-1 text-sm text-neutral-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30';
// Qty and Unit Cost sticky-right columns (always visible, not draggable).
// right offsets: unitCost = options(40) + total(96) = 136px
//               qty = unitCost(136) + unitCost-width(96) = 232px
// Revision sticky block — same right offsets as editable block but for revision data.
// When a revision is open the sticky block expands to show Rev Qty | Rev UC | Rev Total.
// right offsets are identical: rev-qty=232px, rev-uc=136px, rev-total=40px (right-10).
const stickyRevQtyHeaderClassName =
  'sticky right-[232px] z-40 bg-canvas-chrome w-20 min-w-[80px] border-l-2 border-l-brand-400';
const stickyRevUnitCostHeaderClassName =
  'sticky right-[136px] z-40 bg-canvas-chrome w-24 min-w-[96px]';
const stickyRevTotalHeaderClassName = 'sticky right-10 z-40 bg-canvas-chrome w-24 min-w-[96px]';
// Span header: covers all 3 revision cols (80+96+96=272px), anchored at right-10.
const stickyRevQtyExpandedHeaderClassName =
  'sticky top-0 right-[232px] z-50 bg-canvas-chrome w-20 min-w-[80px] border-l-2 border-l-brand-400';
const stickyRevUnitCostExpandedHeaderClassName =
  'sticky top-0 right-[136px] z-50 bg-canvas-chrome w-24 min-w-[96px]';
const stickyRevTotalExpandedHeaderClassName =
  'sticky top-0 right-10 z-50 bg-canvas-chrome w-24 min-w-[96px]';
const stickyRevQtyCellClassName =
  'sticky right-[232px] z-10 bg-canvas-chrome w-20 min-w-[80px] group-hover:bg-canvas-shell';
const stickyRevUnitCostCellClassName =
  'sticky right-[136px] z-10 bg-canvas-chrome w-24 min-w-[96px] group-hover:bg-canvas-shell';
const stickyRevTotalCellClassName =
  'sticky right-10 z-10 bg-canvas-chrome w-24 min-w-[96px] group-hover:bg-canvas-shell';
// Baseline reference columns stay scrollable while an open revision keeps only revised
// values pinned on the right.
const baselineQtyColumnClassName = 'w-20 min-w-[80px]';
const baselineUnitCostColumnClassName = 'w-24 min-w-[96px]';
const baselineTotalColumnClassName = 'w-24 min-w-[96px]';
const revisionNotesColumnClassName = 'min-w-[160px]';

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
  onImport,
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
        <div className="h-9 border-b border-black/10 bg-canvas-chrome" />
        <div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid h-13 grid-cols-6 items-center gap-4 border-b border-black/10 px-4"
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
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-lg border border-black/10 bg-canvas-chrome px-8 py-10 text-center shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <h2 className="font-display text-2xl text-neutral-900">No categories yet</h2>
              <p className="text-sm text-neutral-600">
                Add your first Proposal Category, or import an existing spreadsheet.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setAddCategoryOpen(true)}
              >
                <EmptyStatePlusIcon />
                Add Category
              </Button>
              {onImport && (
                <Button type="button" variant="secondary" size="md" onClick={onImport}>
                  <EmptyStateUploadIcon />
                  Import from Excel
                </Button>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Tip: Proposal Status in the toolbar drives revision tracking once you start pricing.
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
            <p className="text-sm text-neutral-600">
              <strong>{category?.name}</strong> has {itemCount} {itemCount === 1 ? 'item' : 'items'}
              . Choose what to do with them before deleting.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-black/10 p-3 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40">
                <input
                  type="radio"
                  name="delete-category-action"
                  className="mt-0.5 accent-brand-500"
                  checked={!deleteAll}
                  onChange={() => setDeleteAll(false)}
                />
                <span className="text-sm font-medium text-neutral-800">
                  Move items to another category
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-black/10 p-3 transition has-[:checked]:border-danger-500 has-[:checked]:bg-danger-500/5">
                <input
                  type="radio"
                  name="delete-category-action"
                  className="mt-0.5 accent-brand-500"
                  checked={deleteAll}
                  onChange={() => setDeleteAll(true)}
                />
                <span className="text-sm font-medium text-neutral-800">
                  Delete category and all {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </label>
            </div>
            {!deleteAll && (
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Move items to...
                <select
                  value={targetCategoryId}
                  onChange={(event) => setTargetCategoryId(event.target.value)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
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
          <p className="text-sm text-neutral-600">This category is empty and can be deleted.</p>
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

function EmptyStatePlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EmptyStateUploadIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M7 1v8M4 4l3-3 3 3M2 11h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

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
                    className="z-[100] min-w-44 menu-panel"
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
                    {hiddenDefaults.length > 0 && <div className="my-1 h-px bg-neutral-100" />}
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
            <div className="my-1 h-px bg-neutral-100" />
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
  const addItemToFfe = useAddProposalItemToFfe(projectId);
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

  type PendingChange = GeneratedItemChangeInfo & {
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
    const changeInfo = proposalPatchToGeneratedItemChangeInfo(patch, item, customColumnDefs);
    if (!changeInfo) {
      onItemSave(item, { ...patch, version: item.version });
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

  const productTagPrefix = categoryName.slice(0, 2).toUpperCase();
  const nextProductTag = useMemo(() => {
    let max = 0;
    for (const item of items) {
      if (!item.productTag.startsWith(`${productTagPrefix}-`)) continue;
      const suffix = item.productTag.slice(productTagPrefix.length + 1);
      const n = Number(suffix);
      if (Number.isInteger(n) && n > max) max = n;
    }
    return `${productTagPrefix}-${max + 1}`;
  }, [items, productTagPrefix]);

  const handleAddItem = useCallback(() => {
    createItem.mutate({
      sortOrder: items.length,
      productTag: nextProductTag,
      itemName: '',
    });
  }, [createItem, items.length, nextProductTag]);

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

  return (
    <GroupedTableSection>
      <GroupedTableHeader>
        <div className="sticky left-4 flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
            title={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
            className="shrink-0 rounded px-1 text-xs text-brand-100 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
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
              <span className="truncate text-sm font-semibold tracking-tight text-white">{v}</span>
            )}
            inputClassName="text-sm font-semibold text-neutral-950 border-neutral-300 bg-white"
          />
          <span className="shrink-0 rounded-pill bg-white/15 px-2 py-0.5 text-xs font-medium text-brand-50 ring-1 ring-inset ring-white/15">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          <button
            type="button"
            onClick={handleAddItem}
            title={`Add item to ${categoryName}`}
            aria-label={`Add item to ${categoryName}`}
            className="shrink-0 inline-flex items-center gap-1 rounded-pill bg-white/10 px-2 py-0.5 text-xs font-medium text-brand-50 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
          >
            <span aria-hidden="true" className="text-sm leading-none">
              +
            </span>
            Add item
          </button>
          {hasOpenRevision && openRev && (
            <span className="shrink-0 rounded-pill bg-brand-500/25 px-2 py-0.5 text-xs font-medium text-brand-100 ring-1 ring-inset ring-brand-300/50">
              Revision {openRev.label}
            </span>
          )}
        </div>
        <div className="sticky right-4 flex items-center gap-2 [&_.icon-btn]:text-brand-100 [&_.icon-btn:hover]:bg-white/10 [&_.icon-btn:hover]:text-white">
          {!collapsed && !isMobile && <ColumnNavArrows />}
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-white">
            {formatMoney(cents(subtotalCents))}
          </span>
          <CategoryActionsMenu
            categoryName={categoryName}
            hiddenDefaults={hiddenDefaults}
            onCategoryDelete={onCategoryDelete}
            onAddItem={handleAddItem}
            onRestoreDefault={onRestoreDefault}
            onOpenAddColumnModal={() => setAddColumnModalOpen(true)}
          />
          {!collapsed && (
            <button
              type="button"
              aria-label="Expand table view"
              title="Expand table view"
              onClick={() => setIsExpanded(true)}
              className="icon-btn"
            >
              <ExpandIcon />
            </button>
          )}
        </div>
      </GroupedTableHeader>

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
                  <th className="h-10 border-b border-black/10 w-8 min-w-8 px-1" />
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
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600 bg-canvas-chrome',
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
                          className="h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600 bg-canvas-chrome min-w-36"
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
                      {/* Baseline cols scroll with the rest of the table. */}
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          baselineQtyColumnClassName,
                        )}
                      >
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          baselineUnitCostColumnClassName,
                        )}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          baselineTotalColumnClassName,
                        )}
                      >
                        Total
                      </th>
                      {/* Revision notes scroll with the baseline reference columns. */}
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          revisionNotesColumnClassName,
                        )}
                      >
                        Notes
                      </th>
                      {/* Revision sticky column headers */}
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          stickyRevQtyHeaderClassName,
                        )}
                      >
                        Rev Qty
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          stickyRevUnitCostHeaderClassName,
                        )}
                      >
                        Rev Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          stickyRevTotalHeaderClassName,
                        )}
                      >
                        Rev Total
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyValueColumnClassNames.quantity.header,
                        )}
                      >
                        Quantity
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyValueColumnClassNames.unitCost.header,
                        )}
                      >
                        Unit Cost
                      </th>
                      <th
                        className={cn(
                          'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                          proposalStickyEdgeColumnClassNames.totalHeader,
                        )}
                      >
                        Total Cost
                      </th>
                    </>
                  )}
                  <th
                    className={cn(
                      'h-10 border-b border-black/10',
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
                      onAddToFfe={() => handleAddItemToFfe(item)}
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
            onAddToFfe={(item) => handleAddItemToFfe(item)}
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
        <div className="fixed inset-0 z-50 bg-neutral-950/35 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden rounded-sm border border-black/10 bg-canvas-chrome shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-canvas-chrome px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-neutral-950">
                  {categoryName}
                </h2>
                <p className="text-xs text-neutral-500">
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
                <thead className="sticky top-0 z-30 bg-canvas-chrome text-xs">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleColumnDragEnd}
                  >
                    <tr>
                      <th className="h-10 border-b border-black/10 w-8 min-w-8 px-1" />
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
                                  'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600 bg-canvas-chrome',
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
                              className="h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600 bg-canvas-chrome min-w-36"
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
                              'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              baselineQtyColumnClassName,
                            )}
                          >
                            Quantity
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              baselineUnitCostColumnClassName,
                            )}
                          >
                            Unit Cost
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              baselineTotalColumnClassName,
                            )}
                          >
                            Total
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 bg-canvas-chrome px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              revisionNotesColumnClassName,
                            )}
                          >
                            Notes
                          </th>
                          {/* Revision sticky column headers */}
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              stickyRevQtyExpandedHeaderClassName,
                            )}
                          >
                            Rev Qty
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              stickyRevUnitCostExpandedHeaderClassName,
                            )}
                          >
                            Rev Cost
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              stickyRevTotalExpandedHeaderClassName,
                            )}
                          >
                            Rev Total
                          </th>
                        </>
                      ) : (
                        <>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              proposalStickyValueColumnClassNames.quantity.expandedHeader,
                            )}
                          >
                            Quantity
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              proposalStickyValueColumnClassNames.unitCost.expandedHeader,
                            )}
                          >
                            Unit Cost
                          </th>
                          <th
                            className={cn(
                              'h-10 border-b border-black/10 px-3 font-semibold uppercase tracking-[0.12em] text-neutral-600',
                              proposalStickyEdgeColumnClassNames.totalExpandedHeader,
                            )}
                          >
                            Total Cost
                          </th>
                        </>
                      )}
                      <th
                        className={cn(
                          'h-10 border-b border-black/10',
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
                          onAddToFfe={() => handleAddItemToFfe(item)}
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
          lockPriceAffecting={pendingChange.lockPriceAffecting ?? false}
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
  onAddToFfe,
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
  onAddToFfe: () => void;
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
  const [swatchOpen, setSwatchOpen] = useState(false);
  const lineTotal = proposalLineTotalCents(item);
  const stopProp = (e: MouseEvent) => e.stopPropagation();

  const showDots = proposalStatus !== 'in_progress';
  const dot = (columnKey: string) =>
    showDots ? (
      <GeneratedItemColumnChangeDot itemId={item.id} columnKey={columnKey} revisions={revisions} />
    ) : null;

  const cellRenderMap: Record<string, ReactNode> = {
    rendering: (
      <GeneratedItemImageCell
        view="proposal"
        kind="rendering"
        entityId={item.id}
        alt={`${item.productTag || 'Proposal'} rendering`}
        onClick={stopProp}
      />
    ),
    productTag: (
      <GeneratedItemEditableTextCell
        value={item.productTag}
        onSave={(productTag) => onSave({ productTag })}
        indicator={dot('productTag')}
        inputClassName={editInputClassName}
      />
    ),
    itemName: (
      <GeneratedItemEditableTextCell
        value={item.itemName}
        onSave={(itemName) => onSave({ itemName })}
        className="min-w-48"
        indicator={dot('itemName')}
        inputClassName={editInputClassName}
      />
    ),
    plan: (
      <GeneratedItemImageCell
        view="proposal"
        kind="plan"
        entityId={item.id}
        alt={`${item.productTag || 'Proposal'} plan`}
        onClick={stopProp}
      />
    ),
    drawings: (
      <GeneratedItemEditableTextCell
        value={item.drawings}
        onSave={(drawings) => onSave({ drawings })}
        indicator={dot('drawings')}
        inputClassName={editInputClassName}
      />
    ),
    location: (
      <GeneratedItemEditableTextCell
        value={item.location}
        onSave={(location) => onSave({ location })}
        indicator={dot('location')}
        inputClassName={editInputClassName}
      />
    ),
    description: (
      <GeneratedItemEditableTextCell
        value={item.description}
        onSave={(description) => onSave({ description })}
        className="min-w-64"
        indicator={dot('description')}
        inputClassName={editInputClassName}
      />
    ),
    notes: (
      <GeneratedItemEditableTextCell
        value={item.notes}
        onSave={(notes) => onSave({ notes })}
        className="min-w-48"
        indicator={dot('notes')}
        inputClassName={editInputClassName}
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
      />
    ),
    swatch: (
      <GeneratedItemMaterialsCell materials={item.materials} onOpen={() => setSwatchOpen(true)}>
        <MaterialLibraryModal
          open={swatchOpen}
          projectId={projectId}
          context="proposal"
          categoryId={categoryId}
          item={item}
          onClose={() => setSwatchOpen(false)}
        />
      </GeneratedItemMaterialsCell>
    ),
    cbm: (
      <GeneratedItemEditableNumberCell
        value={item.cbm}
        step="0.001"
        onSave={(cbm) => onSave({ cbm })}
        className="w-24"
        inputClassName={editInputClassName}
        indicator={dot('cbm')}
      />
    ),
    // quantity and unitCost are rendered as fixed sticky-right cells below.
    ...Object.fromEntries(
      customColumnDefs.map((def) => [
        def.id,
        <GeneratedItemEditableTextCell
          value={item.customData[def.id] ?? ''}
          onSave={(value) => {
            onSave({ customData: { ...item.customData, [def.id]: value } });
          }}
          indicator={dot(def.id)}
          inputClassName={editInputClassName}
        />,
      ]),
    ),
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      data-dragging={isDragging || undefined}
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
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
        isDragging && 'bg-brand-50 shadow-md opacity-80',
      )}
    >
      <td className="w-8 min-w-8 px-1 py-2" onClick={stopProp}>
        <GeneratedItemDragHandle
          ariaLabel={`Drag ${item.productTag || 'item'}`}
          {...attributes}
          {...listeners}
        />
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
              {/* Baseline reference values scroll with the main table while revised values stay pinned. */}
              <td
                className={cn(
                  'px-3 py-2 text-sm tabular-nums text-neutral-400',
                  baselineQtyColumnClassName,
                )}
              >
                {item.quantity} {item.quantityUnit}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-sm tabular-nums text-neutral-400',
                  baselineUnitCostColumnClassName,
                )}
              >
                {formatMoney(cents(item.unitCostCents))}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-sm tabular-nums text-neutral-400',
                  baselineTotalColumnClassName,
                )}
              >
                {formatMoney(cents(lineTotal))}
              </td>
              <RevisionNotesCell entries={revEntries} tdClassName={revisionNotesColumnClassName} />
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
          <GeneratedItemEditableQuantityCell
            quantity={item.quantity}
            quantityUnit={item.quantityUnit}
            quantityUnits={quantityUnits}
            onSaveQuantity={(quantity) => onSave({ quantity })}
            onSaveUnit={(quantityUnit) => onSave({ quantityUnit })}
            indicator={dot('quantity')}
            tdClassName={proposalStickyValueColumnClassNames.quantity.cell}
            inputClassName={editInputClassName}
          />
          <GeneratedItemEditableMoneyCell
            valueCents={item.unitCostCents}
            onSave={(unitCostCents) => onSave({ unitCostCents })}
            indicator={dot('unitCostCents')}
            tdClassName={proposalStickyValueColumnClassNames.unitCost.cell}
            inputClassName={editInputClassName}
          />
          <td
            className={cn(
              'px-3 py-2 font-semibold text-neutral-900',
              proposalStickyEdgeColumnClassNames.totalCell,
            )}
          >
            {formatMoney(cents(lineTotal))}
          </td>
        </>
      )}
      <td
        className={cn('px-1 py-2', proposalStickyEdgeColumnClassNames.actionsCell)}
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
}

function ProposalItemActionsMenu({
  itemName,
  otherCategories,
  onViewDetails,
  onDuplicate,
  onAddToFfe,
  onMove,
  onDelete,
}: {
  itemName: string;
  otherCategories: { id: string; name: string }[];
  onViewDetails: () => void;
  onDuplicate: () => void;
  onAddToFfe: () => void;
  onMove: (toCategoryId: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
      <GeneratedItemActionTrigger
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open options for ${itemName}`}
        title={`Open options for ${itemName}`}
        onClick={() => setOpen((current) => !current)}
      />
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
            className="z-[100] min-w-48 menu-panel"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onViewDetails)}
            >
              View details
            </button>
            <div className="my-1 h-px bg-neutral-100" />
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onDuplicate)}
            >
              Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={() => runAction(onAddToFfe)}
            >
              Add to FF&amp;E
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
                  <span className="ml-auto text-xs text-neutral-400">{'>'}</span>
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
                      className="z-[100] min-w-40 menu-panel"
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
            <div className="my-1 h-px bg-neutral-100" />
            <button
              type="button"
              role="menuitem"
              className={cn(menuItemClassName, 'text-danger-600')}
              onClick={() => runAction(() => setDeleteOpen(true))}
            >
              Delete item
            </button>
          </div>,
          document.body,
        )}
      <DeleteItemModal
        open={deleteOpen}
        itemName={itemName}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          onDelete();
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

function DeleteItemModal({
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
          <Button type="button" variant="danger" onClick={onConfirm}>
            Delete item
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MobileProposalCards({
  items,
  otherCategories,
  onDelete,
  onDuplicate,
  onAddToFfe,
  onMove,
  onItemClick,
}: {
  items: ProposalItem[];
  otherCategories: { id: string; name: string }[];
  onDelete: (item: ProposalItem) => void;
  onDuplicate: (item: ProposalItem) => void;
  onAddToFfe: (item: ProposalItem) => void;
  onMove: (item: ProposalItem, toCategoryId: string) => void;
  onItemClick: (item: ProposalItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
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
            className="rounded-sm border border-black/10 bg-canvas-chrome p-4 shadow-sm"
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
                    className="truncate text-base font-semibold text-neutral-950 hover:underline text-left"
                  >
                    {item.itemName || item.productTag || item.description || 'Unnamed item'}
                  </button>
                  {item.location && (
                    <p className="mt-0.5 truncate text-sm text-neutral-500">{item.location}</p>
                  )}
                </div>
              </div>
              <ProposalItemActionsMenu
                itemName={item.itemName || item.productTag || item.description || 'item'}
                otherCategories={otherCategories}
                onViewDetails={() => onItemClick(item)}
                onDuplicate={() => onDuplicate(item)}
                onAddToFfe={() => onAddToFfe(item)}
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
