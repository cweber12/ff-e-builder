import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TotalsBar } from '../../shared/table/TotalsBar';
import { DropdownMenu, MenuItem } from '../../primitives';
import {
  ALL_COLUMN_GROUP_ID,
  useColumnDefs,
  useCreateColumnDef,
  useCreateProposalCategory,
  useDeleteColumnDef,
  useDeleteProposalCategory,
  useGeneratedItemColumns,
  usePrefetchProposalItems,
  useProposalWithItems,
  useUpdateColumnDef,
  useUpdateProposalCategory,
  useUpdateProposalItem,
} from '../../../hooks';
import { cents, formatMoney, type Project, type ProposalCategoryWithItems } from '../../../types';
import { proposalCategorySubtotalCents, proposalProjectTotalCents } from '../../../lib/money';
import { ProposalItemDetailPanel } from './detail/ProposalItemDetailPanel';
import { ProposalCategorySection } from './category/ProposalCategorySection';
import { AddGroupModal } from '../../shared/modals/AddGroupModal';
import { DeleteCategoryModal } from './dialogs/DeleteCategoryModal';
import { ProposalEmptyState } from './ProposalEmptyState';
import { PROPOSAL_GENERATED_ITEM_TABLE_PRESET } from '../../../lib/table/generatedItemTablePresets';
import { resolveGeneratedItemColumns } from '../../../lib/table/generatedItemColumnModel';

type ProposalTableProps = {
  projectId: string;
  project?: Project;
  onImport?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  addCategoryOpen?: boolean;
  onAddCategoryOpenChange?: (open: boolean) => void;
};

export function ProposalTable({
  projectId,
  project,
  onImport,
  onDuplicate,
  addCategoryOpen: addCategoryOpenProp,
  onAddCategoryOpenChange,
}: ProposalTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeColumnGroup, setActiveColumnGroup] = useState<string>(ALL_COLUMN_GROUP_ID);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const collapsedCategoryIds = useMemo(
    () => new Set(Object.keys(collapsed).filter((id) => collapsed[id])),
    [collapsed],
  );

  const prefetchProposalItems = usePrefetchProposalItems();
  const { categoriesWithItems, isLoading } = useProposalWithItems(projectId, collapsedCategoryIds);

  const createCategory = useCreateProposalCategory(projectId);
  const updateCategory = useUpdateProposalCategory(projectId);
  const deleteCategory = useDeleteProposalCategory(projectId);
  const updateItem = useUpdateProposalItem();

  const { data: customColumnDefs = [] } = useColumnDefs(projectId, 'proposal');
  const createColumnDef = useCreateColumnDef(projectId, 'proposal');
  const updateColumnDef = useUpdateColumnDef(projectId, 'proposal');
  const deleteColumnDef = useDeleteColumnDef(projectId, 'proposal');
  const proposalColumns = useGeneratedItemColumns<string>({
    projectId,
    preset: PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
    customColumnDefs,
    defaultColumns: PROPOSAL_GENERATED_ITEM_TABLE_PRESET.hideableColumnIds.map((id) => ({
      id,
      column: id,
    })),
    buildCustomColumn: (def) => def.id,
    nonDraggableIds: PROPOSAL_GENERATED_ITEM_TABLE_PRESET.fixedColumnIds,
    activeGroupId: activeColumnGroup,
  });

  const visibleColOrder = useMemo(
    () => proposalColumns.visibleColumns,
    [proposalColumns.visibleColumns],
  );

  const allProposalItems = useMemo(
    () => categoriesWithItems.flatMap((category) => category.items),
    [categoriesWithItems],
  );
  const applyFirstLoadAutoHide = proposalColumns.columnConfig.applyFirstLoadAutoHide;
  useEffect(() => {
    if (isLoading || allProposalItems.length === 0) return;
    const resolvedColumns = resolveGeneratedItemColumns(
      PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
      allProposalItems,
      {
        customColumns: customColumnDefs.map((column) => ({
          id: column.id,
          label: column.label,
        })),
      },
    );
    applyFirstLoadAutoHide(
      resolvedColumns.filter((column) => column.omitWhenEmpty).map((column) => column.id),
    );
  }, [isLoading, allProposalItems, customColumnDefs, applyFirstLoadAutoHide]);

  const [addCategoryOpenInternal, setAddCategoryOpenInternal] = useState(false);
  const isControlledAddCategory =
    addCategoryOpenProp !== undefined && onAddCategoryOpenChange !== undefined;
  const addCategoryOpen = isControlledAddCategory
    ? (addCategoryOpenProp ?? false)
    : addCategoryOpenInternal;
  const setAddCategoryOpen = isControlledAddCategory
    ? onAddCategoryOpenChange
    : setAddCategoryOpenInternal;

  const [selection, setSelection] = useState<{ itemId: string; categoryId: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProposalCategoryWithItems | null>(null);

  const grandTotal = proposalProjectTotalCents(categoriesWithItems);
  const activeCategory = useMemo(
    () => categoriesWithItems.find((category) => category.id === activeCategoryId) ?? null,
    [activeCategoryId, categoriesWithItems],
  );
  const selectedCategory = activeCategory ?? categoriesWithItems[0] ?? null;
  const selectedCategorySubtotal = selectedCategory
    ? proposalCategorySubtotalCents(selectedCategory.items)
    : 0;
  const selectedCategoryItemCount = selectedCategory?.items.length ?? 0;

  const otherCategoriesMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const category of categoriesWithItems) {
      map.set(
        category.id,
        categoriesWithItems
          .filter((current) => current.id !== category.id)
          .map((current) => ({ id: current.id, name: current.name })),
      );
    }
    return map;
  }, [categoriesWithItems]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  useEffect(() => {
    if (categoriesWithItems.length === 0) {
      setActiveCategoryId(null);
      return;
    }

    const hasActiveCategory = categoriesWithItems.some(
      (category) => category.id === activeCategoryId,
    );
    if (!hasActiveCategory) {
      setActiveCategoryId(categoriesWithItems[0]!.id);
    }
  }, [activeCategoryId, categoriesWithItems]);

  useEffect(() => {
    if (!selection) return;
    if (selection.categoryId === activeCategoryId) return;
    setSelection(null);
  }, [activeCategoryId, selection]);

  return (
    <div className="flex flex-1 flex-col">
      {isLoading ? (
        <div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid h-13 grid-cols-6 items-center gap-4 border-b border-neutral-200 px-4"
            >
              <div className="col-span-2 h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
              <div className="h-3 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <section className="rounded-lg border border-neutral-200 bg-canvas-chrome px-5 py-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="eyebrow text-brand-700">Item Library</p>
                <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-center">
                  <ScheduleSelect
                    categories={categoriesWithItems}
                    activeCategoryId={activeCategoryId}
                    onSelect={setActiveCategoryId}
                  />
                  {selectedCategory ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="toolbar-stat">
                        {selectedCategoryItemCount}{' '}
                        {selectedCategoryItemCount === 1 ? 'item' : 'items'}
                      </span>
                      <span className="toolbar-stat">
                        {formatMoney(cents(selectedCategorySubtotal))}
                      </span>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                  Jump into one schedule at a time, scan items without the continuous scroll, and
                  move into denser editing only when the work actually calls for it.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="toolbar-stat">
                  {categoriesWithItems.length}{' '}
                  {categoriesWithItems.length === 1 ? 'schedule' : 'schedules'}
                </span>
                <span className="toolbar-stat">Library total {formatMoney(cents(grandTotal))}</span>
              </div>
            </div>
          </section>

          {categoriesWithItems.length === 0 ? (
            <ProposalEmptyState
              onImport={onImport}
              onAddCategory={() => setAddCategoryOpen(true)}
              onDuplicate={onDuplicate}
            />
          ) : null}

          {selectedCategory ? (
            <ProposalCategorySection
              key={selectedCategory.id}
              projectId={projectId}
              categoryId={selectedCategory.id}
              categoryName={selectedCategory.name}
              items={selectedCategory.items}
              otherCategories={otherCategoriesMap.get(selectedCategory.id) ?? []}
              subtotalCents={selectedCategorySubtotal}
              collapsed={collapsed[selectedCategory.id] ?? false}
              onToggle={() => toggleCollapsed(selectedCategory.id)}
              onCategoryNameSave={(name) =>
                updateCategory.mutate({ id: selectedCategory.id, patch: { name: name.trim() } })
              }
              onCategoryDelete={() => setCategoryToDelete(selectedCategory)}
              onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch, projectId })}
              onItemClick={(item) => {
                setSelection({ itemId: item.id, categoryId: selectedCategory.id });
              }}
              visibleColOrder={visibleColOrder}
              customColumnDefs={customColumnDefs}
              onMoveColumn={(fromId, toId) => proposalColumns.columnConfig.moveColumn(fromId, toId)}
              onHideColumn={(id) => proposalColumns.columnConfig.hideDefaultColumn(id)}
              onRenameCustomColumn={async (defId, label) => {
                await updateColumnDef.mutateAsync({ defId, patch: { label } });
              }}
              onDeleteCustomColumn={(defId) => deleteColumnDef.mutate(defId)}
              hiddenDefaults={proposalColumns.hiddenDefaults}
              onRestoreDefault={proposalColumns.columnConfig.restoreDefaultColumn}
              onAddCustomColumn={async (label) => {
                await createColumnDef.mutateAsync({ label, sortOrder: customColumnDefs.length });
              }}
              proposalStatus={project?.proposalStatus ?? 'in_progress'}
              onPrefetchItems={() => prefetchProposalItems(selectedCategory.id)}
              activeColumnGroup={activeColumnGroup}
              onActiveColumnGroupChange={setActiveColumnGroup}
            />
          ) : null}

          <TotalsBar
            itemCount={selectedCategoryItemCount}
            groupCount={selectedCategory ? 1 : 0}
            groupLabel="schedule"
            grandTotal={formatMoney(cents(selectedCategorySubtotal))}
          />

          <AddGroupModal
            groupLabel="Schedule"
            open={addCategoryOpen}
            onClose={() => setAddCategoryOpen(false)}
            onSubmit={async (name) => {
              const createdCategory = await createCategory.mutateAsync({
                name,
                sortOrder: categoriesWithItems.length,
              });
              setActiveCategoryId(createdCategory.id);
            }}
          />

          {selection && (
            <ProposalItemDetailPanel
              itemId={selection.itemId}
              categoryId={selection.categoryId}
              projectId={projectId}
              onClose={() => setSelection(null)}
              onSelectItemId={(nextItemId: string) =>
                setSelection((current) =>
                  current ? { categoryId: current.categoryId, itemId: nextItemId } : current,
                )
              }
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
        </div>
      )}
    </div>
  );
}

function ScheduleSelect({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: ProposalCategoryWithItems[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}) {
  const activeCategory =
    categories.find((category) => category.id === activeCategoryId) ?? categories[0] ?? null;

  if (!activeCategory) return null;

  return (
    <DropdownMenu
      wrapperClassName="w-full max-w-[28rem]"
      panelClassName="z-[280] min-w-[22rem] max-w-[26rem]"
      positionOptions={{ align: 'bottom', edge: 'left', offsetY: 8 }}
      renderTrigger={({ triggerRef, open, toggleMenu }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-label="Select active schedule"
          aria-haspopup="menu"
          aria-expanded={open}
          className="group flex w-full items-center gap-4 rounded-sm border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-300 hover:bg-brand-50/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          onClick={toggleMenu}
        >
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-neutral-500">Schedule</p>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <span className="truncate font-display text-[1.35rem] font-semibold tracking-tight text-neutral-950">
                {activeCategory.name}
              </span>
              <span className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                Active
              </span>
            </div>
          </div>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-neutral-400 transition group-hover:text-neutral-700 group-[aria-expanded='true']:rotate-180 group-[aria-expanded='true']:text-neutral-900"
            aria-hidden="true"
          />
        </button>
      )}
    >
      {({ closeMenu }) =>
        categories.map((category) => {
          const itemCount = category.items.length;
          const subtotal = proposalCategorySubtotalCents(category.items);
          const isActive = category.id === activeCategory.id;

          return (
            <MenuItem
              key={category.id}
              type="button"
              className="flex items-start justify-between gap-4"
              onClick={() => {
                closeMenu();
                onSelect(category.id);
              }}
            >
              <div className="min-w-0">
                <span
                  className={
                    isActive ? 'font-bold text-neutral-950' : 'font-medium text-neutral-800'
                  }
                >
                  {category.name}
                </span>
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="block font-mono text-xs font-semibold tabular-nums text-neutral-800">
                  {formatMoney(cents(subtotal))}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.08em] text-neutral-500">
                  {isActive ? 'Current' : 'Open'}
                </span>
              </div>
            </MenuItem>
          );
        })
      }
    </DropdownMenu>
  );
}
