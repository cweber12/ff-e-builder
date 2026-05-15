import type {
  Project,
  RoomWithItems,
  ProposalCategoryWithItems,
  ProposalStatus,
} from '../../types';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  exportTablePdf,
  exportCatalogPdf,
  exportProposalPdf,
  exportTableCsv,
  exportTableExcel,
  exportProposalCsv,
  exportProposalExcel,
} from '../../lib/export';
import { useUserProfile } from '../../hooks';
import { useColumnDefs } from '../../hooks';
import { ProposalStatusSelect } from '../shared/ProposalStatusSelect';
import { useUpdateProject, useProposalRevisions } from '../../hooks';
import { ColumnVisibilityPopover } from '../shared/ColumnVisibilityPopover';

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
// Export dropdown
// ---------------------------------------------------------------------------
interface ExportMenuProps {
  disabled?: boolean;
  items: { label: string; onSelect: () => void }[];
}

function ExportMenu({ disabled, items }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(e.target as Node) ?? false;
      const inMenu = menuRef.current?.contains(e.target as Node) ?? false;
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-40`}
        title="Export"
      >
        <DownloadIcon />
        <span className="hidden sm:inline">Export</span>
      </button>
      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              right: window.innerWidth - triggerRect.right,
            }}
            className="z-[100] min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-md"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

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

      <ExportMenu
        disabled={!hasItems}
        items={
          isCatalog
            ? [
                {
                  label: 'Export PDF',
                  onSelect: () => void exportCatalogPdf(project, roomsWithItems),
                },
              ]
            : [
                {
                  label: 'Export PDF',
                  onSelect: () => void exportTablePdf(project, roomsWithItems),
                },
                {
                  label: 'Export Excel',
                  onSelect: () => void exportTableExcel(project, roomsWithItems),
                },
                {
                  label: 'Export CSV',
                  onSelect: () => exportTableCsv(project, roomsWithItems),
                },
              ]
        }
      />

      {!isCatalog && <ColumnVisibilityPopover projectId={project.id} tableKey="ffe" />}
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
  const { data: revisionsData } = useProposalRevisions(project.id);
  const hasItems = categoriesWithItems.some((c) => c.items.length > 0);

  const openRev = revisionsData?.revisions.find((r) => r.closedAt === null) ?? null;
  const unresolvedCount = openRev
    ? (revisionsData?.snapshots ?? []).filter(
        (s) => s.revisionId === openRev.id && s.costStatus === 'flagged',
      ).length
    : 0;

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
        {...(openRev
          ? { revisionGuard: { openRevisionLabel: openRev.label, unresolvedCount } }
          : {})}
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

      <ExportMenu
        disabled={!hasItems}
        items={[
          {
            label: 'Export PDF',
            onSelect: () =>
              void exportProposalPdf(
                project,
                categoriesWithItems,
                userProfile,
                { mode: 'continuous' },
                customColumnDefs,
              ),
          },
          {
            label: 'Export Excel',
            onSelect: () =>
              void exportProposalExcel(
                project,
                categoriesWithItems,
                userProfile,
                customColumnDefs,
                revisionsData,
              ),
          },
          {
            label: 'Export CSV',
            onSelect: () => exportProposalCsv(project, categoriesWithItems, customColumnDefs),
          },
        ]}
      />

      <ColumnVisibilityPopover projectId={project.id} tableKey="proposal" />
    </div>
  );
}
