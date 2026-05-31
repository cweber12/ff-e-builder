import type {
  Project,
  RoomWithItems,
  ProposalCategoryWithItems,
  ProposalStatus,
} from '../../types';
import { useMemo, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { exportTablePdf, exportTableCsv, exportTableExcel } from '../../lib/export';
import { useFfeItemSort, useUserProfile } from '../../hooks';
import { readColumnConfigFromStorage, useColumnDefs, useItemColumnDefs } from '../../hooks';
import { ProposalStatusSelect } from '../shared/ProposalStatusSelect';
import { ExportMenu } from '../shared/ExportMenu';
import { Button } from '../primitives';
import {
  useUpdateProject,
  useProposalRevisions,
  useRevisionSnapshots,
  useRevisionChangelog,
} from '../../hooks';
import { useColumnConfig } from '../../hooks/shared';
import { ColumnVisibilityPopover } from '../shared/ColumnVisibilityPopover';
import { ProposalExportModal } from '../shared/modals/ProposalExportModal';

// Toolbar actions use shared Button toolbar variants.

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
  layout?: 'row' | 'column';
}

export function FfeActions({
  project,
  roomsWithItems,
  onAddRoom,
  onImport,
  layout = 'row',
}: FfeActionsProps) {
  const isColumn = layout === 'column';
  const hasItems = roomsWithItems.some((r) => r.items.length > 0);
  const { data: ffeCustomColumnDefs = [] } = useItemColumnDefs(project.id);
  const ffeColumnOrder = () => readColumnConfigFromStorage(project.id, 'ffe')?.order;

  return (
    <div className={isColumn ? 'project-sidebar-slot' : 'flex items-center gap-2'}>
      <Button
        type="button"
        variant="addAction"
        onClick={onAddRoom}
        {...(isColumn ? { className: 'justify-start' } : {})}
      >
        <Plus className="toolbar-icon" aria-hidden="true" />
        Add room
      </Button>

      <FfeSortToggle projectId={project.id} layout={layout} />

      <Button
        type="button"
        variant="toolbar"
        onClick={onImport}
        title="Import from Excel"
        {...(isColumn ? { className: 'project-sidebar-control justify-start' } : {})}
      >
        <Upload className="toolbar-icon" aria-hidden="true" />
        Import
      </Button>

      <ExportMenu
        disabled={!hasItems}
        {...(isColumn ? { buttonClassName: 'project-sidebar-control justify-between' } : {})}
        label={
          <>
            <Download className="toolbar-icon" aria-hidden="true" />
            Export
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
      />

      <ColumnVisibilityPopover
        projectId={project.id}
        tableKey="ffe"
        {...(isColumn ? { buttonClassName: 'project-sidebar-control justify-start' } : {})}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FF&E item sort toggle
// ---------------------------------------------------------------------------
function FfeSortToggle({
  projectId,
  layout = 'row',
}: {
  projectId: string;
  layout?: 'row' | 'column';
}) {
  const { sortMode, setSortMode } = useFfeItemSort(projectId);

  return (
    <div
      role="radiogroup"
      aria-label="Item sort order"
      className={
        layout === 'column'
          ? 'toolbar-segmented project-sidebar-slot !flex !flex-col !items-start [&>button]:!justify-start'
          : 'toolbar-segmented'
      }
    >
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
  layout?: 'row' | 'column';
}

export function ProposalActions({
  project,
  categoriesWithItems,
  onAddCategory,
  onImport,
  layout = 'row',
}: ProposalActionsProps) {
  const isColumn = layout === 'column';
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
    <div className={isColumn ? 'project-sidebar-slot' : 'flex items-center gap-2'}>
      <Button
        type="button"
        variant="addAction"
        onClick={onAddCategory}
        {...(isColumn ? { className: 'justify-start' } : {})}
      >
        <Plus className="toolbar-icon" aria-hidden="true" />
        Add category
      </Button>

      <Button
        type="button"
        variant="toolbar"
        onClick={onImport}
        title="Import from Excel"
        {...(isColumn ? { className: 'project-sidebar-control justify-start' } : {})}
      >
        <Upload className="toolbar-icon" aria-hidden="true" />
        Import
      </Button>

      <Button
        type="button"
        variant="toolbar"
        disabled={!hasItems}
        onClick={() => setExportModalOpen(true)}
        title="Export"
        {...(isColumn ? { className: 'project-sidebar-control justify-start' } : {})}
      >
        <Download className="toolbar-icon" aria-hidden="true" />
        Export
      </Button>

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

      <ColumnVisibilityPopover
        projectId={project.id}
        tableKey="proposal"
        {...(isColumn ? { buttonClassName: 'project-sidebar-control justify-start' } : {})}
      />

      <div
        className={
          isColumn
            ? 'w-full border-t border-neutral-200/80 pt-2.5'
            : 'flex items-center border-l border-neutral-200 pl-2'
        }
      >
        {isColumn ? <p className="toolbar-label pb-1">Proposal status</p> : null}
        <ProposalStatusSelect
          status={project.proposalStatus}
          onChange={handleStatusChange}
          disabled={updateProject.isPending}
          {...(isColumn ? { compact: true } : {})}
          {...(isColumn ? { className: 'w-full' } : {})}
          {...(openRev
            ? { revisionGuard: { openRevisionLabel: openRev.label, unresolvedCount } }
            : {})}
        />
      </div>
    </div>
  );
}
