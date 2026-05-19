import { useMemo, useState } from 'react';
import { MeasuredPlanCard } from '../components/plans/list/MeasuredPlanCard';
import { PlanGridSkeleton } from '../components/plans/list/PlanGridSkeleton';
import { PlanUploadPanel } from '../components/plans/list/PlanUploadPanel';
import { Button } from '../components/primitives';
import { useCreateMeasuredPlan, useDeleteMeasuredPlan, useMeasuredPlans } from '../hooks';
import type { CreateMeasuredPlanInput } from '../lib/api';
import type { MeasuredPlan, Project } from '../types';

type PlansPageProps = {
  project: Project;
};

type FilterId = 'all' | 'calibrated' | 'uncalibrated';
type SortId = 'added' | 'name' | 'measurements';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'calibrated', label: 'Calibrated' },
  { id: 'uncalibrated', label: 'Needs calibration' },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: 'added', label: 'Recently added' },
  { id: 'name', label: 'Name' },
  { id: 'measurements', label: 'Measurement count' },
];

export function PlansPage({ project }: PlansPageProps) {
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const createPlan = useCreateMeasuredPlan(project.id);
  const deletePlan = useDeleteMeasuredPlan(project.id);
  const [filter, setFilter] = useState<FilterId>('all');
  const [sort, setSort] = useState<SortId>('added');
  const [uploadOpen, setUploadOpen] = useState(false);

  const planCount = plans?.length ?? 0;
  const calibratedCount = useMemo(
    () => (plans ?? []).filter((plan) => plan.calibrationStatus === 'calibrated').length,
    [plans],
  );

  const visiblePlans = useMemo(() => {
    const list = plans ?? [];
    const filtered =
      filter === 'all' ? list : list.filter((plan) => plan.calibrationStatus === filter);
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'measurements') return b.measurementCount - a.measurementCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [filter, plans, sort]);

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
    setUploadOpen(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2">
      <header className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Plans</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-neutral-950">
              Plan library
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Architectural sheets used for measurement. Each plan keeps its own scale context so
              measurements stay tied to the correct source drawing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
              <span className="num">{planCount}</span>
              <span>plan{planCount === 1 ? '' : 's'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-success-700">
              <span className="num">{calibratedCount}</span>
              <span>calibrated</span>
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setUploadOpen((open) => !open)}
              aria-expanded={uploadOpen}
              aria-controls="plan-upload-panel"
            >
              {uploadOpen ? 'Close upload' : 'Upload plan'}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Filter plans"
          >
            {FILTERS.map((entry) => {
              const active = filter === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(entry.id)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition focus-ring',
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900',
                  ].join(' ')}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortId)}
              className="input-compact font-medium normal-case tracking-normal text-neutral-900"
            >
              {SORTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {uploadOpen ? (
        <div id="plan-upload-panel" className="animate-fade-up">
          <PlanUploadPanel creating={createPlan.isPending} onCreatePlan={handleCreatePlan} />
        </div>
      ) : null}

      <section>
        {isLoading ? (
          <PlanGridSkeleton />
        ) : visiblePlans.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visiblePlans.map((plan, index) => (
              <div
                key={plan.id}
                className="animate-fade-up"
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
        ) : (
          <EmptyState
            title="No plans match this filter"
            description="Try a different filter to see plans that aren't currently visible."
            actionLabel="Show all plans"
            onAction={() => setFilter('all')}
          />
        )}
      </section>
    </div>
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
    <div className="canvas-hatch flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 py-14 text-center">
      <BlueprintIcon />
      <h2 className="mt-4 font-display text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p>
      <Button type="button" variant="primary" size="sm" className="mt-5" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
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
      className="text-brand-500"
      aria-hidden
    >
      <rect x="8" y="6" width="32" height="36" rx="2" />
      <path d="M14 14h20M14 22h14M14 30h20M14 36h10" strokeLinecap="round" />
      <path d="M32 26l6 6M38 26l-6 6" strokeLinecap="round" />
    </svg>
  );
}
