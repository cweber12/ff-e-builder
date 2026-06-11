import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload } from 'lucide-react';
import { MeasuredPlanCard } from '../components/plans/list/MeasuredPlanCard';
import { PlanGridSkeleton } from '../components/plans/list/PlanGridSkeleton';
import { PlanUploadModal } from '../components/plans/list/PlanUploadModal';
import { Button, MenuItem } from '../components/primitives';
import { useCreateMeasuredPlan, useDeleteMeasuredPlan, useMeasuredPlans } from '../hooks';
import type { CreateMeasuredPlanInput } from '../lib/api';
import type { MeasuredPlan, Project } from '../types';
import { SidebarHeaderMenu } from '../components/shared/sidebar';

type PlansPageProps = {
  project: Project;
};

export const PLANS_ACTIONS_SLOT_ID = 'plans-actions-slot';
export const PLANS_FILTER_SLOT_ID = 'plans-filter-slot';
export const PLANS_SUMMARY_SLOT_ID = 'plans-summary-slot';
export const PLANS_OPTIONS_SLOT_ID = 'plans-options-slot';

type SortId = 'added' | 'name' | 'measurements';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'added', label: 'Recently added' },
  { id: 'name', label: 'Name' },
  { id: 'measurements', label: 'Measurement count' },
];

export function PlansPage({ project }: PlansPageProps) {
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const createPlan = useCreateMeasuredPlan(project.id);
  const deletePlan = useDeleteMeasuredPlan(project.id);
  const [sort, setSort] = useState<SortId>('added');
  const [uploadOpen, setUploadOpen] = useState(false);

  const planCount = plans?.length ?? 0;
  const calibratedCount = useMemo(
    () => (plans ?? []).filter((plan) => plan.calibrationStatus === 'calibrated').length,
    [plans],
  );

  const visiblePlans = useMemo(() => {
    const list = plans ?? [];
    const sorted = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'measurements') return b.measurementCount - a.measurementCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [plans, sort]);

  async function handleDelete(plan: MeasuredPlan) {
    const message =
      plan.measurementCount > 0
        ? `Delete "${plan.name}"? ${plan.measurementCount} saved measurement${plan.measurementCount === 1 ? '' : 's'} reference this plan.`
        : `Delete "${plan.name}"?`;

    if (!window.confirm(message)) return;
    await deletePlan.mutateAsync(plan);
  }

  async function handleCreatePlan(input: CreateMeasuredPlanInput) {
    await createPlan.mutateAsync(input);
  }

  return (
    <div className="mx-auto max-w-7xl py-4">
      <PlansSummaryBar planCount={planCount} calibratedCount={calibratedCount} />

      <PlansViewFilters sort={sort} onSortChange={setSort} />

      <PlansOptionsMenu onUpload={() => setUploadOpen(true)} />

      <PlansActionsBar onUpload={() => setUploadOpen(true)} />

      <PlanUploadModal
        open={uploadOpen}
        creating={createPlan.isPending}
        onClose={() => setUploadOpen(false)}
        onCreatePlan={handleCreatePlan}
      />

      <section>
        {isLoading ? (
          <PlanGridSkeleton />
        ) : visiblePlans.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-4">
            {visiblePlans.map((plan, index) => (
              <div
                key={plan.id}
                className="animate-fade-up w-full md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.75rem)] 2xl:w-[calc(25%-0.75rem)]"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <MeasuredPlanCard
                  plan={plan}
                  projectId={project.id}
                  onDelete={() => void handleDelete(plan)}
                  deleting={deletePlan.isPending && deletePlan.variables?.id === plan.id}
                />
              </div>
            ))}
          </div>
        ) : planCount === 0 ? (
          <EmptyState
            title="No plans uploaded yet"
            description="Upload the first architectural image or PDF page for this project to start building the Plans workspace."
            actionLabel="Upload your first plan"
            onAction={() => setUploadOpen(true)}
          />
        ) : null}
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
  sort,
  onSortChange,
}: {
  sort: SortId;
  onSortChange: (value: SortId) => void;
}) {
  const slot = useSidebarPortalSlot(PLANS_FILTER_SLOT_ID);

  if (!slot) return null;

  return createPortal(
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
    </label>,
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
  planCount,
  calibratedCount,
}: {
  planCount: number;
  calibratedCount: number;
}) {
  const slot = useSidebarPortalSlot(PLANS_SUMMARY_SLOT_ID);

  if (!slot) return null;

  return createPortal(
    <div className="flex w-full items-center gap-1.5">
      <span className="toolbar-stat flex-1 justify-center !px-2 !py-0.5 text-[10px]">
        <span className="num text-neutral-950">{planCount}</span>
        <span className="text-neutral-500">plan{planCount === 1 ? '' : 's'}</span>
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
