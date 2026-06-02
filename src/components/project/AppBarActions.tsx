import type { Project, ProposalCategoryWithItems, ProposalStatus } from '../../types';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useUserProfile } from '../../hooks';
import { useColumnDefs } from '../../hooks';
import { ProposalStatusSelect } from '../shared/ProposalStatusSelect';
import { Button, MenuItem, MenuSeparator } from '../primitives';
import {
  useUpdateProject,
  useProposalRevisions,
  useRevisionSnapshots,
  useRevisionChangelog,
} from '../../hooks';
import { useColumnConfig } from '../../hooks/shared';
import { ColumnVisibilityPanel } from '../shared/ColumnVisibilityPopover';
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

// ---------------------------------------------------------------------------
// Proposal action cluster
// ---------------------------------------------------------------------------
interface ProposalActionsProps {
  project: Project;
  categoriesWithItems: ProposalCategoryWithItems[];
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
          Add category
        </SidebarButton>
      ) : (
        <Button type="button" variant="addAction" onClick={onAddCategory}>
          <Plus className="toolbar-icon" aria-hidden="true" />
          Add category
        </Button>
      )}
    </div>
  );
}

export function ProposalOptionsMenu({
  project,
  categoriesWithItems,
  onAddCategory,
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
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsAnchorRect, setColumnsAnchorRect] = useState<DOMRect | null>(null);

  return (
    <>
      <SidebarHeaderMenu ariaLabel="Proposal options">
        {({ closeMenu }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                onAddCategory();
              }}
            >
              Add category
            </MenuItem>
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
            <MenuSeparator />
            <MenuItem
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                closeMenu();
                setColumnsAnchorRect(rect);
                setColumnsOpen(true);
              }}
            >
              Columns
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
      {columnsOpen && columnsAnchorRect ? (
        <ColumnVisibilityPanel
          projectId={project.id}
          tableKey="proposal"
          triggerRect={columnsAnchorRect}
          onClose={() => setColumnsOpen(false)}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Proposal revision summary — compact chip for the top of the sidebar
// ---------------------------------------------------------------------------
export function ProposalRevisionChip({ project }: { project: Project }) {
  const { data: revisions = [] } = useProposalRevisions(project.id);
  const { data: snapshots = [] } = useRevisionSnapshots(project.id);

  const openRev = revisions.find((r) => r.closedAt === null) ?? null;
  if (!openRev) return null;

  const revSnapshots = snapshots.filter((s) => s.revisionId === openRev.id);
  const flagged = revSnapshots.filter((s) => s.costStatus === 'flagged').length;
  const resolved = revSnapshots.filter((s) => s.costStatus === 'resolved').length;

  return (
    <div className="flex w-full flex-col gap-1 rounded-sm bg-brand-50/60 px-2.5 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-900">
        {openRev.label}
      </span>
      <span className="flex items-center gap-3 text-[10px] font-medium text-neutral-700">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-warning-500" aria-hidden="true" />
          {flagged} flagged
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
          {resolved} resolved
        </span>
      </span>
    </div>
  );
}

export function ProposalSidebarContext({ project }: { project: Project }) {
  const updateProject = useUpdateProject();
  const { data: revisions = [] } = useProposalRevisions(project.id);
  const { data: snapshots = [] } = useRevisionSnapshots(project.id);

  const openRev = revisions.find((r) => r.closedAt === null) ?? null;
  const unresolvedCount = openRev
    ? snapshots.filter((s) => s.revisionId === openRev.id && s.costStatus === 'flagged').length
    : 0;

  async function handleStatusChange(next: ProposalStatus) {
    await updateProject.mutateAsync({
      id: project.id,
      patch: { proposalStatus: next },
    });
  }

  return (
    <div className="project-sidebar-slot gap-2.5">
      <ProposalRevisionChip project={project} />
      <div className="w-full border-t border-neutral-200/80 pt-2">
        <p className="toolbar-label pb-1">Proposal status</p>
        <ProposalStatusSelect
          status={project.proposalStatus}
          onChange={handleStatusChange}
          disabled={updateProject.isPending}
          compact
          className="w-full"
          {...(openRev
            ? { revisionGuard: { openRevisionLabel: openRev.label, unresolvedCount } }
            : {})}
        />
      </div>
    </div>
  );
}
