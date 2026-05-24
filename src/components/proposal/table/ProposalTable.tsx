import { useCallback, useMemo, useState } from 'react';
import { Button } from '../../primitives';
import { TotalsBar } from '../../shared/table/TotalsBar';
import { TableViewStack } from '../../shared/table/TableViewWrappers';
import {
  useColumnConfig,
  useColumnDefs,
  useCreateColumnDef,
  useCreateProposalCategory,
  useDeleteColumnDef,
  useDeleteProposalCategory,
  usePrefetchProposalItems,
  useProposalRevisions,
  useProposalWithItems,
  useRevisionSnapshots,
  useUpdateColumnDef,
  useUpdateProposalCategory,
  useUpdateProposalItem,
} from '../../../hooks';
import { cents, formatMoney, type Project, type ProposalCategoryWithItems } from '../../../types';
import { proposalCategorySubtotalCents, proposalProjectTotalCents } from '../../../lib/money';
import { ProposalItemDetailPanel } from './ProposalItemDetailPanel';
import { ProposalCategorySection } from './ProposalCategorySection';
import { AddGroupModal } from './AddGroupModal';
import { DeleteCategoryModal } from './DeleteCategoryModal';
import {
  PROPOSAL_COLUMN_META,
  PROPOSAL_HIDEABLE_IDS,
  type ProposalColumnId,
} from './proposalTableConstants';

type ProposalTableProps = {
  projectId: string;
  project?: Project;
  onImport?: (() => void) | undefined;
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const collapsedCategoryIds = useMemo(
    () => new Set(Object.keys(collapsed).filter((id) => collapsed[id])),
    [collapsed],
  );

  const prefetchProposalItems = usePrefetchProposalItems();
  const { categoriesWithItems, isLoading } = useProposalWithItems(projectId, collapsedCategoryIds);
  const { data: revisions = [] } = useProposalRevisions(projectId);
  const { data: snapshots = [] } = useRevisionSnapshots(projectId);

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

  const openRev = useMemo(
    () => revisions.find((revision) => revision.closedAt === null) ?? null,
    [revisions],
  );
  const revisionCounts = useMemo(() => {
    if (!openRev) return { flagged: 0, resolved: 0 };
    let flagged = 0;
    let resolved = 0;
    for (const snapshot of snapshots) {
      if (snapshot.revisionId !== openRev.id) continue;
      if (snapshot.costStatus === 'flagged') flagged += 1;
      else if (snapshot.costStatus === 'resolved') resolved += 1;
    }
    return { flagged, resolved };
  }, [openRev, snapshots]);

  const orderedFlaggedItemIds = useMemo(() => {
    if (!openRev) return [] as string[];
    const flagged = new Set(
      snapshots
        .filter(
          (snapshot) => snapshot.revisionId === openRev.id && snapshot.costStatus === 'flagged',
        )
        .map((snapshot) => snapshot.itemId),
    );

    const ids: string[] = [];
    for (const category of categoriesWithItems) {
      const sorted = [...category.items].sort((a, b) => a.sortOrder - b.sortOrder);
      for (const item of sorted) {
        if (flagged.has(item.id)) ids.push(item.id);
      }
    }
    return ids;
  }, [openRev, snapshots, categoriesWithItems]);

  const jumpToNextFlagged = useCallback(() => {
    if (orderedFlaggedItemIds.length === 0) return;
    const rows = orderedFlaggedItemIds
      .map((id) => document.querySelector<HTMLTableRowElement>(`tr[data-item-id="${id}"]`))
      .filter((row): row is HTMLTableRowElement => row !== null);

    if (rows.length === 0) return;

    const scrollY = window.scrollY;
    const next = rows.find((row) => row.getBoundingClientRect().top + scrollY > scrollY + 80);
    const target = next ?? rows[0];
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.focus();
  }, [orderedFlaggedItemIds]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }, []);

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
      {openRev && (
        <RevisionBanner
          revisionLabel={openRev.label}
          flaggedCount={revisionCounts.flagged}
          resolvedCount={revisionCounts.resolved}
          onJumpToNextFlagged={jumpToNextFlagged}
        />
      )}

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
          visibleColOrder={columnConfig.visibleOrder}
          customColumnDefs={customColumnDefs}
          onMoveColumn={(fromId, toId) => columnConfig.moveColumn(fromId, toId)}
          onHideColumn={(id) => columnConfig.hideDefaultColumn(id)}
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
          onPrefetchItems={() => prefetchProposalItems(category.id)}
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
  );
}

function RevisionBanner({
  revisionLabel,
  flaggedCount,
  resolvedCount,
  onJumpToNextFlagged,
}: {
  revisionLabel: string;
  flaggedCount: number;
  resolvedCount: number;
  onJumpToNextFlagged: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span className="font-semibold uppercase tracking-[0.1em]">Revision {revisionLabel}</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        <span>
          <strong className="tabular-nums">{flaggedCount}</strong> flagged
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span>
          <strong className="tabular-nums">{resolvedCount}</strong> resolved
        </span>
      </span>
      {flaggedCount > 0 && (
        <button
          type="button"
          onClick={onJumpToNextFlagged}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          Jump to next flagged {'->'}
        </button>
      )}
    </div>
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
