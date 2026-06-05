import type { Project, ProposalCategoryWithItems, ProposalStatus } from '../../types';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useUserProfile } from '../../hooks';
import { useColumnDefs } from '../../hooks';
import { ProposalStatusSelect } from '../shared/ProposalStatusSelect';
import { Button, MenuItem } from '../primitives';
import {
  useUpdateProject,
  useProposalRevisions,
  useRevisionSnapshots,
  useRevisionChangelog,
} from '../../hooks';
import { useColumnConfig } from '../../hooks/shared';
import { ProposalExportModal } from '../shared/modals/ProposalExportModal';
import { SidebarButton, SidebarHeaderMenu } from '../shared/sidebar';

// Default draggable column IDs for the proposal table (matches ProposalTable's PROPOSAL_HIDEABLE_IDS).
// quantity and unitCost are sticky-right and not included here; they are always appended at export time.
const PROPOSAL_DEFAULT_COLS = [
  'rendering',
  'itemName',
  'plan',
  'drawings',
  'location',
  'description',
  'notes',
  'size',
  'swatch',
  'cbm',
] as const;

const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  in_progress: 'Draft',
  pricing_complete: 'Pricing complete',
  submitted: 'Submitted',
  approved: 'Approved',
};

// ---------------------------------------------------------------------------
// Proposal action cluster
// ---------------------------------------------------------------------------
interface ProposalActionsProps {
  project: Project;
  categoriesWithItems: ProposalCategoryWithItems[];
  revisionMode?: boolean;
  onRevisionModeChange?: (next: boolean) => void;
  onOpenSpreadsheetRequest?:
    | ((request: { categoryId: string; filter: 'all' | 'flagged' } | null) => void)
    | undefined;
  onAddCategory: () => void;
  onImport: () => void;
  layout?: 'row' | 'column';
}

export function ProposalActions({
  onAddCategory,
  layout = 'row',
}: Pick<ProposalActionsProps, 'onAddCategory' | 'layout'>) {
  const isColumn = layout === 'column';

  return (
    <div className={isColumn ? 'project-sidebar-slot' : 'flex items-center gap-2'}>
      {isColumn ? (
        <SidebarButton variant="add" type="button" onClick={onAddCategory}>
          <Plus className="toolbar-icon" aria-hidden="true" />
          Add schedule
        </SidebarButton>
      ) : (
        <Button type="button" variant="addAction" onClick={onAddCategory}>
          <Plus className="toolbar-icon" aria-hidden="true" />
          Add schedule
        </Button>
      )}
    </div>
  );
}

export function ProposalOptionsMenu({
  project,
  categoriesWithItems,
  onImport,
}: ProposalActionsProps) {
  const { data: userProfile } = useUserProfile();
  const { data: customColumnDefs = [] } = useColumnDefs(project.id, 'proposal');
  const { data: revisions = [] } = useProposalRevisions(project.id);
  const { data: snapshots = [] } = useRevisionSnapshots(project.id);
  const { data: changelog = [] } = useRevisionChangelog(project.id);
  const { visibleOrder } = useColumnConfig(
    project.id,
    'proposal',
    PROPOSAL_DEFAULT_COLS,
    customColumnDefs,
  );
  const exportVisibleOrder = useMemo(() => ['productTag', ...visibleOrder], [visibleOrder]);
  const hasItems = categoriesWithItems.some((c) => c.items.length > 0);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  return (
    <>
      <SidebarHeaderMenu ariaLabel="Item Library options">
        {({ closeMenu }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                onImport();
              }}
            >
              Upload
            </MenuItem>
            <MenuItem
              disabled={!hasItems}
              onClick={() => {
                closeMenu();
                setExportModalOpen(true);
              }}
            >
              Download
            </MenuItem>
          </>
        )}
      </SidebarHeaderMenu>
      <ProposalExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        project={project}
        categoriesWithItems={categoriesWithItems}
        userProfile={userProfile ?? null}
        customColumnDefs={customColumnDefs}
        revisionData={{ revisions, snapshots, changelog }}
        visibleOrder={exportVisibleOrder}
      />
    </>
  );
}

export function ProposalSidebarSections({
  project,
  categoriesWithItems,
  onOpenSpreadsheetRequest,
}: ProposalActionsProps) {
  return (
    <ProposalSidebarContext
      project={project}
      categoriesWithItems={categoriesWithItems}
      onOpenSpreadsheetRequest={onOpenSpreadsheetRequest}
    />
  );
}

export function ProposalSidebarContext({
  project,
  categoriesWithItems,
  onOpenSpreadsheetRequest,
}: {
  project: Project;
  categoriesWithItems: ProposalCategoryWithItems[];
  onOpenSpreadsheetRequest?:
    | ((request: { categoryId: string; filter: 'all' | 'flagged' } | null) => void)
    | undefined;
}) {
  const updateProject = useUpdateProject();
  const { data: revisions = [] } = useProposalRevisions(project.id);
  const { data: snapshots = [] } = useRevisionSnapshots(project.id);

  const openRev = revisions.find((r) => r.closedAt === null) ?? null;
  const unresolvedCount = openRev
    ? snapshots.filter((s) => s.revisionId === openRev.id && s.costStatus === 'flagged').length
    : 0;
  const firstFlaggedCategoryId = useMemo(() => {
    if (!openRev) return null;
    const flaggedItemIds = new Set(
      snapshots
        .filter(
          (snapshot) => snapshot.revisionId === openRev.id && snapshot.costStatus === 'flagged',
        )
        .map((snapshot) => snapshot.itemId),
    );
    if (flaggedItemIds.size === 0) return null;
    const flaggedCategory = categoriesWithItems.find((category) =>
      category.items.some((item) => flaggedItemIds.has(item.id)),
    );
    return flaggedCategory?.id ?? null;
  }, [categoriesWithItems, openRev, snapshots]);

  async function handleStatusChange(next: ProposalStatus) {
    await updateProject.mutateAsync({
      id: project.id,
      patch: { proposalStatus: next },
    });
  }

  return (
    <div className="project-sidebar-slot gap-2">
      <div className="project-sidebar-slot gap-2">
        <p className="toolbar-label">Proposal status</p>
        <p className="text-[12px] font-semibold text-neutral-900">
          {PROPOSAL_STATUS_LABEL[project.proposalStatus]}
        </p>
        <ProposalStatusSelect
          status={project.proposalStatus}
          onChange={handleStatusChange}
          disabled={updateProject.isPending}
          compact
          className="w-full"
          {...(firstFlaggedCategoryId && unresolvedCount > 0
            ? {
                blockedAction: {
                  label: 'Open flagged items in Spreadsheet View',
                  onClick: () =>
                    onOpenSpreadsheetRequest?.({
                      categoryId: firstFlaggedCategoryId,
                      filter: 'flagged',
                    }),
                },
              }
            : {})}
          {...(openRev
            ? { revisionGuard: { openRevisionLabel: openRev.label, unresolvedCount } }
            : {})}
        />
      </div>
    </div>
  );
}
