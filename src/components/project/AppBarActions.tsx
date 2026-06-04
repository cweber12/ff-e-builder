import type { Project, ProposalCategoryWithItems, ProposalStatus } from '../../types';
import { useMemo, useState, type ReactNode } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
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

const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  in_progress: 'In progress',
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
      <SidebarHeaderMenu ariaLabel="Item Library options">
        {({ closeMenu }) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu();
                onAddCategory();
              }}
            >
              Add schedule
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
          side={typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'left' : 'right'}
          onClose={() => setColumnsOpen(false)}
        />
      ) : null}
    </>
  );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="project-sidebar-slot gap-2.5">
      <p className="toolbar-label">{title}</p>
      {children}
    </div>
  );
}

export function ProposalSidebarSections({
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
  const hasItems = categoriesWithItems.some((category) => category.items.length > 0);
  const scheduleCount = categoriesWithItems.length;
  const itemCount = categoriesWithItems.reduce((sum, category) => sum + category.items.length, 0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsAnchorRect, setColumnsAnchorRect] = useState<DOMRect | null>(null);

  return (
    <>
      <SidebarSection title="Workflow">
        <ProposalSidebarContext project={project} />
      </SidebarSection>

      <SidebarSection title="View">
        <div className="flex flex-wrap gap-2">
          <span className="toolbar-stat">
            {scheduleCount} {scheduleCount === 1 ? 'schedule' : 'schedules'}
          </span>
          <span className="toolbar-stat">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </SidebarSection>

      <SidebarSection title="Actions">
        <ProposalActions onAddCategory={onAddCategory} layout="column" />
        <div className="project-sidebar-slot">
          <SidebarButton type="button" onClick={onImport}>
            <Upload className="toolbar-icon" aria-hidden="true" />
            Import
          </SidebarButton>
        </div>
      </SidebarSection>

      <SidebarSection title="Display">
        <div className="project-sidebar-slot gap-2">
          <SidebarButton
            type="button"
            disabled={!hasItems}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="toolbar-icon" aria-hidden="true" />
            Export
          </SidebarButton>
          <SidebarButton
            type="button"
            onClick={(event) => {
              setColumnsAnchorRect(event.currentTarget.getBoundingClientRect());
              setColumnsOpen(true);
            }}
          >
            Columns
          </SidebarButton>
        </div>
      </SidebarSection>

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
          side={typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'left' : 'right'}
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
    <div className="flex w-full flex-col gap-1 rounded-sm border border-brand-200/70 bg-brand-50/40 px-3 py-2">
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
    <div className="project-sidebar-slot gap-3">
      <div className="w-full rounded-sm border border-neutral-200 bg-canvas-chrome px-3 py-3 shadow-sm">
        <p className="toolbar-label">Proposal status</p>
        <p className="mt-1 text-[13px] font-semibold text-neutral-950">
          {PROPOSAL_STATUS_LABEL[project.proposalStatus]}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
          Control the proposal workflow stage here before moving deeper into revisions and client
          review.
        </p>
        <ProposalStatusSelect
          status={project.proposalStatus}
          onChange={handleStatusChange}
          disabled={updateProject.isPending}
          compact
          className="mt-3 w-full"
          {...(openRev
            ? { revisionGuard: { openRevisionLabel: openRev.label, unresolvedCount } }
            : {})}
        />
      </div>
      <ProposalRevisionChip project={project} />
    </div>
  );
}
