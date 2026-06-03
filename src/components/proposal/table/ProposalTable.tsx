import { useCallback, useEffect, useMemo, useState } from 'react';
import { TotalsBar } from '../../shared/table/TotalsBar';
import { TableViewStack } from '../../shared/table/TableViewWrappers';
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
  const totalItemCount = categoriesWithItems.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
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
        <TableViewStack>
          <section className="rounded-lg border border-neutral-200 bg-canvas-chrome px-5 py-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="eyebrow text-brand-700">Item Library</p>
                <h1 className="mt-1 font-display text-[1.9rem] font-semibold tracking-tight text-neutral-950">
                  Project items organized into schedules.
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                  A calmer shell for specification work: image-rich item schedules, proposal-owned
                  pricing, and focused editing without changing the underlying route or export
                  contracts.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="toolbar-stat">
                  {categoriesWithItems.length}{' '}
                  {categoriesWithItems.length === 1 ? 'schedule' : 'schedules'}
                </span>
                <span className="toolbar-stat">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="toolbar-stat">{formatMoney(cents(grandTotal))}</span>
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

          {categoriesWithItems.map((category) => (
            <ProposalCategorySection
              key={category.id}
              projectId={projectId}
              categoryId={category.id}
              categoryName={category.name}
              items={category.items}
              otherCategories={otherCategoriesMap.get(category.id) ?? []}
              subtotalCents={proposalCategorySubtotalCents(category.items)}
              collapsed={collapsed[category.id] ?? false}
              onToggle={() => toggleCollapsed(category.id)}
              onCategoryNameSave={(name) =>
                updateCategory.mutate({ id: category.id, patch: { name: name.trim() } })
              }
              onCategoryDelete={() => setCategoryToDelete(category)}
              onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch, projectId })}
              onItemClick={(item) => {
                setSelection({ itemId: item.id, categoryId: category.id });
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
              onPrefetchItems={() => prefetchProposalItems(category.id)}
              activeColumnGroup={activeColumnGroup}
              onActiveColumnGroupChange={setActiveColumnGroup}
            />
          ))}

          <TotalsBar
            itemCount={totalItemCount}
            groupCount={categoriesWithItems.length}
            groupLabel="categories"
            grandTotal={formatMoney(cents(grandTotal))}
          />

          <AddGroupModal
            groupLabel="Schedule"
            open={addCategoryOpen}
            onClose={() => setAddCategoryOpen(false)}
            onSubmit={async (name) => {
              await createCategory.mutateAsync({ name, sortOrder: categoriesWithItems.length });
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
        </TableViewStack>
      )}
    </div>
  );
}
