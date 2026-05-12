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
import { ExportMenu } from '../../shared/ExportMenu';
import { ProposalItemDetailPanel } from './ProposalItemDetailPanel';
import { ImageFrame } from '../../shared/ImageFrame';
import {
  useCreateProposalCategory,
  useCreateProposalItem,
  useDeleteProposalCategory,
  useDeleteProposalItem,
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
} from '../../../hooks';
import { MaterialBadges, MaterialLibraryModal } from '../../materials/MaterialLibraryModal';
import {
  dollarsToCents,
  cents,
  formatMoney,
  parseUnitCostDollarsInput,
  type Project,
  type ProposalItem,
  type ProposalCategoryWithItems,
  type CustomColumnDef,
} from '../../../types';
import { exportProposalCsv, exportProposalExcel, exportProposalPdf } from '../../../lib/export';
import { useUserProfile } from '../../../hooks';
import {
  proposalCategorySubtotalCents,
  proposalLineTotalCents,
  proposalProjectTotalCents,
} from '../../../lib/budgetCalc';
import type { UpdateProposalItemInput } from '../../../lib/api';
import { DimensionEditorModal } from '../../shared/DimensionEditorModal';
import {
  GroupedTableHeader,
  GroupedTableSection,
  StickyGrandTotal,
  TableViewStack,
} from '../../shared/TableViewWrappers';
import { AddGroupModal } from '../../shared/AddGroupModal';
import { SortableColHeader } from '../../shared/SortableColHeader';
import { CustomColumnHeader } from '../../shared/CustomColumnHeader';
import { AddColumnModal } from '../../shared/AddColumnModal';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/utils';

// --- Proposal Table Column Definitions ---
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
  'quantity',
  'unitCost',
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
  quantity: { label: 'Quantity', className: 'w-44 min-w-44' },
  unitCost: { label: 'Unit Cost', className: 'w-32 min-w-32' },
};

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;
const editInputClassName =
  'rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:outline-none';
const stickyTotalHeaderClassName = 'sticky right-24 z-20 bg-white';
const stickyOptionsHeaderClassName = 'sticky right-0 z-30 bg-white w-24 min-w-24';
const stickyTotalExpandedHeaderClassName = 'sticky top-0 right-24 z-50 bg-white';
const stickyOptionsExpandedHeaderClassName = 'sticky top-0 right-0 z-[60] bg-white w-24 min-w-24';
const stickyTotalCellClassName = 'sticky right-24 z-10 bg-white';
const stickyOptionsCellClassName = 'sticky right-0 z-20 bg-white w-24 min-w-24';

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
};

export function ProposalTable({ projectId, project, onImport }: ProposalTableProps) {
  const { categoriesWithItems, isLoading } = useProposalWithItems(projectId);
  const { data: userProfile } = useUserProfile();
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
    'quantity',
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
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<ProposalItem | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | undefined>(undefined);
  const [categoryToDelete, setCategoryToDelete] = useState<ProposalCategoryWithItems | null>(null);
  const grandTotal = proposalProjectTotalCents(categoriesWithItems);

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <TableViewStack>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAddCategoryOpen(true)}
        >
          <PlusIcon />
          Add category
        </Button>
        <div className="flex items-center gap-2">
          {project && (
            <ExportMenu
              label="Export"
              size="sm"
              disabled={categoriesWithItems.every((c) => c.items.length === 0)}
              onCsv={() => exportProposalCsv(project, categoriesWithItems, customColumnDefs)}
              onExcel={() =>
                void exportProposalExcel(
                  project,
                  categoriesWithItems,
                  userProfile,
                  customColumnDefs,
                )
              }
              onPdf={() =>
                void exportProposalPdf(
                  project,
                  categoriesWithItems,
                  userProfile,
                  { mode: 'continuous' },
                  customColumnDefs,
                )
              }
            />
          )}
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <UploadIcon />
              Import
            </button>
          )}
        </div>
      </div>

      {categoriesWithItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
          <p className="text-sm font-semibold text-gray-900">No Proposal Categories yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create a category to start your Proposal Table.
          </p>
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
          onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch })}
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
        />
      ))}

      <StickyGrandTotal value={formatMoney(cents(grandTotal))} />

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

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 12.5V4.5m0 0L7 7.5m3-3 3 3M4.5 13.5v1a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const ref = useRef<HTMLDivElement>(null);
  const columnTriggerRef = useRef<HTMLButtonElement>(null);
  const columnSubmenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inMain = ref.current?.contains(event.target as Node) ?? false;
      const inSubmenu = columnSubmenuRef.current?.contains(event.target as Node) ?? false;
      if (!inMain && !inSubmenu) {
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

  return (
    <div ref={ref} className="relative inline-flex">
      <button
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
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
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
                    left: columnTriggerRef.current.getBoundingClientRect().right + 4,
                  }}
                  className="z-50 min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
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
        </div>
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
}) {
  const createItem = useCreateProposalItem(categoryId);
  const deleteItem = useDeleteProposalItem(categoryId);
  const moveItem = useMoveProposalItem();
  const updateItem = useUpdateProposalItem();
  const isMobile = useIsMobileViewport();
  const [isExpanded, setIsExpanded] = useState(false);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
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
          <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}
              >
                <tr>
                  <th className="border-b border-gray-200 w-8 min-w-8 px-1 py-2" />
                  <SortableContext items={visibleColOrder} strategy={horizontalListSortingStrategy}>
                    {visibleColOrder.map((colId) => {
                      const meta = PROPOSAL_COLUMN_META[colId as ProposalColumnId];
                      if (meta) {
                        return (
                          <SortableColHeader
                            key={colId}
                            colId={colId}
                            label={meta.label}
                            className={cn(
                              'border-b border-gray-200 px-3 py-2 font-semibold',
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
                          className="border-b border-gray-200 px-3 py-2 font-semibold min-w-36"
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
                  <th
                    className={cn(
                      'border-b border-gray-200 px-3 py-2 font-semibold w-32 min-w-32',
                      stickyTotalHeaderClassName,
                    )}
                  >
                    Total Cost
                  </th>
                  <th
                    className={cn(
                      'border-b border-gray-200 font-semibold',
                      stickyOptionsHeaderClassName,
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
                      onSave={(patch) => onItemSave(item, { ...patch, version: item.version })}
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
              <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-40 bg-white text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_rgb(243_244_246)]">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleColumnDragEnd}
                  >
                    <tr>
                      <th className="border-b border-gray-100 w-8 min-w-8 px-1 py-3" />
                      <SortableContext
                        items={visibleColOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        {visibleColOrder.map((colId) => {
                          const meta = PROPOSAL_COLUMN_META[colId as ProposalColumnId];
                          if (meta) {
                            return (
                              <SortableColHeader
                                key={colId}
                                colId={colId}
                                label={meta.label}
                                className={cn(
                                  'border-b border-gray-100 px-3 py-3 font-semibold',
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
                              className="border-b border-gray-100 px-3 py-3 font-semibold min-w-36"
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
                      <th
                        className={cn(
                          'border-b border-gray-100 px-3 py-3 font-semibold w-32 min-w-32',
                          stickyTotalExpandedHeaderClassName,
                        )}
                      >
                        Total Cost
                      </th>
                      <th
                        className={cn(
                          'border-b border-gray-100 font-semibold',
                          stickyOptionsExpandedHeaderClassName,
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
                          onSave={(patch) => onItemSave(item, { ...patch, version: item.version })}
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [sizeOpen, setSizeOpen] = useState(false);
  const [swatchOpen, setSwatchOpen] = useState(false);
  const lineTotal = proposalLineTotalCents(item);
  const stopProp = (e: MouseEvent) => e.stopPropagation();

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
      <EditableCell value={item.productTag} onSave={(productTag) => onSave({ productTag })} />
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
    drawings: <EditableCell value={item.drawings} onSave={(drawings) => onSave({ drawings })} />,
    location: <EditableCell value={item.location} onSave={(location) => onSave({ location })} />,
    description: (
      <EditableCell
        value={item.description}
        onSave={(description) => onSave({ description })}
        className="min-w-64"
      />
    ),
    notes: (
      <EditableCell value={item.notes} onSave={(notes) => onSave({ notes })} className="min-w-48" />
    ),
    size: (
      <td className="px-3 py-2" onClick={stopProp}>
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
      />
    ),
    quantity: (
      <QuantityCell
        quantity={item.quantity}
        quantityUnit={item.quantityUnit}
        onSaveQuantity={(quantity) => onSave({ quantity })}
        onSaveUnit={(quantityUnit) => onSave({ quantityUnit })}
      />
    ),
    unitCost: (
      <MoneyCell
        valueCents={item.unitCostCents}
        onSave={(unitCostCents) => onSave({ unitCostCents })}
      />
    ),
    ...Object.fromEntries(
      customColumnDefs.map((def) => [
        def.id,
        <EditableCell
          value={item.customData[def.id] ?? ''}
          onSave={(value) => {
            onSave({ customData: { ...item.customData, [def.id]: value } });
          }}
        />,
      ]),
    ),
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer border-b border-gray-100 align-top last:border-b-0 hover:bg-brand-50/30',
        isDragging && 'bg-brand-50 shadow-md opacity-80',
      )}
      onClick={onRowClick}
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
      <td className={cn('px-3 py-2 font-semibold text-gray-900', stickyTotalCellClassName)}>
        {formatMoney(cents(lineTotal))}
      </td>
      <td
        className={cn('flex items-center gap-1 px-3 py-2', stickyOptionsCellClassName)}
        onClick={stopProp}
      >
        <button
          type="button"
          aria-label={`View details for ${item.productTag || item.description || 'item'}`}
          title="View details"
          onClick={onRowClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <EyeIcon />
        </button>
        <ProposalItemActionsMenu
          itemName={item.productTag || item.description || 'item'}
          otherCategories={otherCategories}
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
  onDuplicate,
  onMove,
  onDelete,
}: {
  itemName: string;
  otherCategories: { id: string; name: string }[];
  onDuplicate: () => void;
  onMove: (toCategoryId: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
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

  return (
    <div ref={ref} className="relative inline-flex">
      <button
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
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
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
              {moveOpen && (
                <div
                  role="menu"
                  className="absolute right-full top-0 z-40 mr-1 min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
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
                </div>
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
        </div>
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
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
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
}: {
  value: number;
  onSave: (value: number) => void;
  step: string;
  className?: string;
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
}: {
  valueCents: number;
  onSave: (value: number) => void;
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
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
}: {
  quantity: number;
  quantityUnit: string;
  onSaveQuantity: (value: number) => void;
  onSaveUnit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
          className="block w-40 cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50"
        >
          {quantity} {quantityUnit}
        </span>
      </td>
    );
  }

  return (
    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
      <div
        className="flex w-40 gap-2"
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
