import type {
  Project,
  RoomWithItems,
  ProposalCategoryWithItems,
  ProposalStatus,
} from '../../types';
import { exportTablePdf, exportCatalogPdf, exportProposalPdf } from '../../lib/export';
import { useUserProfile } from '../../hooks';
import { useColumnDefs } from '../../hooks';
import { ProposalStatusSelect } from '../shared/ProposalStatusSelect';
import { useUpdateProject } from '../../hooks';

// ---------------------------------------------------------------------------
// Shared icon buttons
// ---------------------------------------------------------------------------
function UploadIcon() {
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M7 1v8M4 10l3 3 3-3M2 13h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="2" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="6.5" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const ghostBtn =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors';

// ---------------------------------------------------------------------------
// FF&E action cluster
// ---------------------------------------------------------------------------
interface FfeActionsProps {
  project: Project;
  roomsWithItems: RoomWithItems[];
  isCatalog: boolean;
  onAddRoom: () => void;
  onImport: () => void;
}

export function FfeActions({
  project,
  roomsWithItems,
  isCatalog,
  onAddRoom,
  onImport,
}: FfeActionsProps) {
  const hasItems = roomsWithItems.some((r) => r.items.length > 0);

  return (
    <div className="flex items-center gap-1">
      {!isCatalog && (
        <button
          type="button"
          onClick={onAddRoom}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <PlusIcon />
          Add Room
        </button>
      )}

      <button type="button" onClick={onImport} className={ghostBtn} title="Import from Excel">
        <UploadIcon />
        <span className="hidden sm:inline">Import</span>
      </button>

      <button
        type="button"
        disabled={!hasItems}
        onClick={() => {
          if (isCatalog) {
            void exportCatalogPdf(project, roomsWithItems);
          } else {
            void exportTablePdf(project, roomsWithItems);
          }
        }}
        className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-40`}
        title="Export"
      >
        <DownloadIcon />
        <span className="hidden sm:inline">Export</span>
      </button>

      <button
        type="button"
        title="Column visibility & density"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
      >
        <ColumnsIcon />
      </button>
    </div>
  );
}

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
  const hasItems = categoriesWithItems.some((c) => c.items.length > 0);

  async function handleStatusChange(next: ProposalStatus) {
    await updateProject.mutateAsync({
      id: project.id,
      patch: { proposalStatus: next },
    });
  }

  return (
    <div className="flex items-center gap-1">
      <ProposalStatusSelect
        status={project.proposalStatus}
        onChange={handleStatusChange}
        disabled={updateProject.isPending}
      />

      <button
        type="button"
        onClick={onAddCategory}
        className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
      >
        <PlusIcon />
        Add Category
      </button>

      <button type="button" onClick={onImport} className={ghostBtn} title="Import from Excel">
        <UploadIcon />
        <span className="hidden sm:inline">Import</span>
      </button>

      <button
        type="button"
        disabled={!hasItems}
        onClick={() =>
          void exportProposalPdf(
            project,
            categoriesWithItems,
            userProfile,
            { mode: 'continuous' },
            customColumnDefs,
          )
        }
        className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-40`}
        title="Export"
      >
        <DownloadIcon />
        <span className="hidden sm:inline">Export</span>
      </button>

      <button
        type="button"
        title="Column visibility & density"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
      >
        <ColumnsIcon />
      </button>
    </div>
  );
}
