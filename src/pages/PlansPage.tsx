import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Upload } from 'lucide-react';
import { PlanDocumentCard } from '../components/plans/list/PlanDocumentCard';
import { PlanGridSkeleton } from '../components/plans/list/PlanGridSkeleton';
import { PlanUploadModal } from '../components/plans/list/PlanUploadModal';
import { Button, MenuItem } from '../components/primitives';
import { useCreatePlanDocument, useDeletePlanDocument, usePlanDocuments } from '../hooks';
import type { CreatePlanDocumentInput } from '../lib/api';
import type { PlanDocument, Project } from '../types';
import { SidebarHeaderMenu } from '../components/shared/sidebar';

type PlansPageProps = {
  project: Project;
};

export const PLANS_ACTIONS_SLOT_ID = 'plans-actions-slot';
export const PLANS_FILTER_SLOT_ID = 'plans-filter-slot';
export const PLANS_SUMMARY_SLOT_ID = 'plans-summary-slot';
export const PLANS_OPTIONS_SLOT_ID = 'plans-options-slot';

type SortId = 'updated' | 'name' | 'sheets' | 'measurements';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'name', label: 'Name' },
  { id: 'sheets', label: 'Sheet count' },
  { id: 'measurements', label: 'Measurement count' },
];

export function PlansPage({ project }: PlansPageProps) {
  const { data: documents, isLoading } = usePlanDocuments(project.id);
  const createDocument = useCreatePlanDocument(project.id);
  const deleteDocument = useDeletePlanDocument(project.id);
  const [sort, setSort] = useState<SortId>('updated');
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const documentCount = documents?.length ?? 0;
  const sheetCount = useMemo(
    () => (documents ?? []).reduce((total, document) => total + document.sheetCount, 0),
    [documents],
  );
  const calibratedCount = useMemo(
    () => (documents ?? []).reduce((total, document) => total + document.calibratedSheetCount, 0),
    [documents],
  );

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const list = (documents ?? []).filter((document) => {
      if (!normalizedQuery) return true;
      const coverSheet = document.coverSheet;
      return [
        document.name,
        document.sourceFilename,
        coverSheet?.name,
        coverSheet?.sheetReference,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    });

    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'sheets') return b.sheetCount - a.sheetCount;
      if (sort === 'measurements') return b.measurementCount - a.measurementCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [documents, query, sort]);

  async function handleDelete(document: PlanDocument) {
    const message =
      document.measurementCount > 0
        ? `Delete "${document.name}"? This will remove ${document.sheetCount} sheet${document.sheetCount === 1 ? '' : 's'} and ${document.measurementCount} saved measurement${document.measurementCount === 1 ? '' : 's'}.`
        : `Delete "${document.name}" and its ${document.sheetCount} sheet${document.sheetCount === 1 ? '' : 's'}?`;

    if (!window.confirm(message)) return;
    await deleteDocument.mutateAsync(document);
  }

  async function handleCreateDocument(input: CreatePlanDocumentInput) {
    await createDocument.mutateAsync(input);
  }

  return (
    <div className="mx-auto max-w-7xl py-4">
      <PlansSummaryBar
        documentCount={documentCount}
        sheetCount={sheetCount}
        calibratedCount={calibratedCount}
      />

      <PlansViewFilters query={query} sort={sort} onQueryChange={setQuery} onSortChange={setSort} />

      <PlansOptionsMenu onUpload={() => setUploadOpen(true)} />

      <PlansActionsBar onUpload={() => setUploadOpen(true)} />

      <PlanUploadModal
        open={uploadOpen}
        creating={createDocument.isPending}
        onClose={() => setUploadOpen(false)}
        onCreateDocument={handleCreateDocument}
      />

      <section>
        {isLoading ? (
          <PlanGridSkeleton />
        ) : visibleDocuments.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-4">
            {visibleDocuments.map((document, index) => (
              <div
                key={document.id}
                className="animate-fade-up w-full md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.75rem)] 2xl:w-[calc(25%-0.75rem)]"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <PlanDocumentCard
                  document={document}
                  projectId={project.id}
                  onDelete={() => void handleDelete(document)}
                  deleting={
                    deleteDocument.isPending && deleteDocument.variables?.id === document.id
                  }
                />
              </div>
            ))}
          </div>
        ) : documentCount === 0 ? (
          <EmptyState
            title="No plan documents uploaded yet"
            description="Upload the first architectural image or PDF drawing set for this project to start building the Plans workspace."
            actionLabel="Upload your first document"
            onAction={() => setUploadOpen(true)}
          />
        ) : (
          <EmptyState
            title="No matching plan documents"
            description="Adjust the search term to find a document by name, source file, cover sheet, or sheet reference."
            actionLabel="Clear search"
            onAction={() => setQuery('')}
          />
        )}
      </section>
    </div>
  );
}

function useSidebarPortalSlot(slotId: string) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const resolveSlot = () => {
      const next = document.getElementById(slotId);
      setSlot((current) => (current === next ? current : next));
    };

    resolveSlot();
    const observer = new MutationObserver(resolveSlot);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [slotId]);

  return slot;
}

function PlansViewFilters({
  query,
  sort,
  onQueryChange,
  onSortChange,
}: {
  query: string;
  sort: SortId;
  onQueryChange: (value: string) => void;
  onSortChange: (value: SortId) => void;
}) {
  const slot = useSidebarPortalSlot(PLANS_FILTER_SLOT_ID);

  if (!slot) return null;

  return createPortal(
    <div className="flex w-full flex-col gap-3">
      <label className="toolbar-label flex w-full flex-col items-start gap-1">
        <span>Search</span>
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Document or sheet"
            className="toolbar-input w-full pl-8"
          />
        </div>
      </label>

      <label className="toolbar-label flex w-full flex-col items-start gap-1">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SortId)}
          className="toolbar-select w-full"
        >
          {SORTS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
    </div>,
    slot,
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="canvas-hatch flex flex-col items-center border-y border-dashed border-neutral-300 px-6 py-16 text-center">
      <BlueprintIcon />
      <h2 className="mt-5 font-display text-lg font-semibold text-neutral-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p>
      <Button type="button" variant="primary" size="sm" className="mt-6" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function PlansActionsBar({ onUpload }: { onUpload: () => void }) {
  const slot = useSidebarPortalSlot(PLANS_ACTIONS_SLOT_ID);

  if (!slot) return null;

  return createPortal(
    <div className="project-sidebar-slot">
      <Button
        type="button"
        variant="addAction"
        onClick={onUpload}
        aria-haspopup="dialog"
        className="project-sidebar-control justify-start"
      >
        <Upload className="toolbar-icon" aria-hidden="true" />
        Upload plan
      </Button>
    </div>,
    slot,
  );
}

function PlansOptionsMenu({ onUpload }: { onUpload: () => void }) {
  const slot = useSidebarPortalSlot(PLANS_OPTIONS_SLOT_ID);

  if (!slot) return null;

  return createPortal(
    <SidebarHeaderMenu ariaLabel="Plans options">
      {({ closeMenu }) => (
        <MenuItem
          onClick={() => {
            closeMenu();
            onUpload();
          }}
        >
          Upload plan
        </MenuItem>
      )}
    </SidebarHeaderMenu>,
    slot,
  );
}

function PlansSummaryBar({
  documentCount,
  sheetCount,
  calibratedCount,
}: {
  documentCount: number;
  sheetCount: number;
  calibratedCount: number;
}) {
  const slot = useSidebarPortalSlot(PLANS_SUMMARY_SLOT_ID);

  if (!slot) return null;

  return createPortal(
    <div className="flex w-full items-center gap-1.5">
      <span className="toolbar-stat flex-1 justify-center !px-2 !py-0.5 text-[10px]">
        <span className="num text-neutral-950">{documentCount}</span>
        <span className="text-neutral-500">doc{documentCount === 1 ? '' : 's'}</span>
      </span>
      <span className="toolbar-stat flex-1 justify-center !px-2 !py-0.5 text-[10px]">
        <span className="num text-neutral-950">{sheetCount}</span>
        <span className="text-neutral-500">sheet{sheetCount === 1 ? '' : 's'}</span>
      </span>
      <span className="toolbar-stat toolbar-stat--success flex-1 justify-center !px-2 !py-0.5 text-[10px]">
        <span className="num">{calibratedCount}</span>
        <span>calibrated</span>
      </span>
    </div>,
    slot,
  );
}

function BlueprintIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className="text-brand-700"
      aria-hidden
    >
      <rect x="8" y="6" width="32" height="36" />
      <path d="M14 14h20M14 22h14M14 30h20M14 36h10" strokeLinecap="square" />
      <path d="M32 26l6 6M38 26l-6 6" strokeLinecap="square" />
    </svg>
  );
}
