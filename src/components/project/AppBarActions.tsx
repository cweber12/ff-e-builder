import type {
  Project,
  RoomWithItems,
  ProposalCategoryWithItems,
  ProposalStatus,
} from '../../types';
import { useMemo, useState } from 'react';
import { exportTablePdf, exportTableCsv, exportTableExcel } from '../../lib/export';
import { useFfeItemSort, useUserProfile } from '../../hooks';
import { readColumnConfigFromStorage, useColumnDefs, useItemColumnDefs } from '../../hooks';
import { ProposalStatusSelect } from '../shared/ProposalStatusSelect';
import { ExportMenu } from '../shared/ExportMenu';
import {
  useUpdateProject,
  useProposalRevisions,
  useRevisionSnapshots,
  useRevisionChangelog,
} from '../../hooks';
import { useColumnConfig } from '../../hooks/shared';
import { ColumnVisibilityPopover } from '../shared/ColumnVisibilityPopover';
import { ProposalExportModal } from '../shared/modals/ProposalExportModal';

// ---------------------------------------------------------------------------
// Shared icon buttons
// ---------------------------------------------------------------------------
function UploadIcon() {
  return (
    <svg viewBox="0 0 14 14" className="toolbar-icon" aria-hidden="true">
      <path d="M7 1v8M4 4l3-3 3 3M2 11h10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 14 14" className="toolbar-icon" aria-hidden="true">
      <path d="M7 1v8M4 10l3 3 3-3M2 13h10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" className="toolbar-icon" aria-hidden="true">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

// All toolbar actions use the shared .btn-action utility (uppercase eyebrow).
// Variants:
//   default          neutral outlined
//   --primary        filled brand (Add Category / Add Room / etc.)
//   --active         pressed/selected state for toggles

// ---------------------------------------------------------------------------
// FF&E action cluster
// ---------------------------------------------------------------------------
interface FfeActionsProps {
  project: Project;
  roomsWithItems: RoomWithItems[];
  /**
   * Retained for backwards compatibility — callers should only render
   * <FfeActions> on the table route. The catalog route uses a portal-based
   * toolbar provided by CatalogView (see CATALOG_ACTIONS_SLOT_ID).
   */
  isCatalog?: boolean;
  onAddRoom: () => void;
  onImport: () => void;
}

export function FfeActions({ project, roomsWithItems, onAddRoom, onImport }: FfeActionsProps) {
  const hasItems = roomsWithItems.some((r) => r.items.length > 0);
  const { data: ffeCustomColumnDefs = [] } = useItemColumnDefs(project.id);
  const ffeColumnOrder = () => readColumnConfigFromStorage(project.id, 'ffe')?.order;

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onAddRoom} className="btn-action btn-action--primary">
        <PlusIcon />
        <span className="btn-action__label">Add room</span>
      </button>

      <FfeSortToggle projectId={project.id} />

      <button type="button" onClick={onImport} className="btn-action" title="Import from Excel">
        <UploadIcon />
        <span className="btn-action__label">Import</span>
      </button>

      <ExportMenu
        disabled={!hasItems}
        label={
          <>
            <DownloadIcon />
            <span className="btn-action__label">Export</span>
          </>
        }
        onPdf={() =>
          void exportTablePdf(
            project,
            roomsWithItems,
            undefined,
            ffeCustomColumnDefs,
            ffeColumnOrder(),
          )
        }
        onExcel={() =>
          void exportTableExcel(
            project,
            roomsWithItems,
            undefined,
            ffeCustomColumnDefs,
            ffeColumnOrder(),
          )
        }
        onCsv={() =>
          exportTableCsv(project, roomsWithItems, undefined, ffeCustomColumnDefs, ffeColumnOrder())
        }
        buttonClassName="btn-action"
      />

      <ColumnVisibilityPopover projectId={project.id} tableKey="ffe" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FF&E item sort toggle
// ---------------------------------------------------------------------------
function FfeSortToggle({ projectId }: { projectId: string }) {
  const { sortMode, setSortMode } = useFfeItemSort(projectId);

  return (
    <div role="radiogroup" aria-label="Item sort order" className="toolbar-segmented">
      <button
        type="button"
        role="radio"
        aria-checked={sortMode === 'manual'}
        data-active={sortMode === 'manual' || undefined}
        onClick={() => setSortMode('manual')}
        title="Custom drag-and-drop order"
      >
        Custom
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={sortMode === 'idTag'}
        data-active={sortMode === 'idTag' || undefined}
        onClick={() => setSortMode('idTag')}
        title="Sort items alphanumerically by ID"
      >
        By ID
      </button>
    </div>
  );
}

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
}

export function ProposalActions({
  project,
  categoriesWithItems,
  onAddCategory,
  onImport,
}: ProposalActionsProps) {
  const { data: userProfile } = useUserProfile();
  const { data: customColumnDefs = [] } = useColumnDefs(project.id, 'proposal');
  const updateProject = useUpdateProject();
  const { data: revisions = [] } = useProposalRevisions(project.id);
  const { data: snapshots = [] } = useRevisionSnapshots(project.id);
  const { data: changelog = [] } = useRevisionChangelog(project.id);
  const { visibleOrder } = useColumnConfig(
    project.id,
    'proposal',
    PROPOSAL_DEFAULT_COLS,
    customColumnDefs,
  );
  // Product tag is now fixed chrome in the table (not draggable/hideable),
  // but should still be available in exports.
  const exportVisibleOrder = useMemo(() => ['productTag', ...visibleOrder], [visibleOrder]);
  const hasItems = categoriesWithItems.some((c) => c.items.length > 0);
  const [exportModalOpen, setExportModalOpen] = useState(false);

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
    <div className="flex items-center gap-2">
      <button type="button" onClick={onAddCategory} className="btn-action btn-action--primary">
        <PlusIcon />
        <span className="btn-action__label">Add category</span>
      </button>

      <button type="button" onClick={onImport} className="btn-action" title="Import from Excel">
        <UploadIcon />
        <span className="btn-action__label">Import</span>
      </button>

      <button
        type="button"
        disabled={!hasItems}
        onClick={() => setExportModalOpen(true)}
        className="btn-action"
        title="Export"
      >
        <DownloadIcon />
        <span className="btn-action__label">Export</span>
      </button>

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

      <ColumnVisibilityPopover projectId={project.id} tableKey="proposal" />

      <div className="ml-auto flex items-center border-l border-neutral-200 pl-2">
        <ProposalStatusSelect
          status={project.proposalStatus}
          onChange={handleStatusChange}
          disabled={updateProject.isPending}
          {...(openRev
            ? { revisionGuard: { openRevisionLabel: openRev.label, unresolvedCount } }
            : {})}
        />
      </div>
    </div>
  );
}
