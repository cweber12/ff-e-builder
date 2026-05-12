import { MeasuredPlanCard } from '../components/plans/MeasuredPlanCard';
import { PlanGridSkeleton } from '../components/plans/PlanGridSkeleton';
import { PlanUploadPanel } from '../components/plans/PlanUploadPanel';
import { useCreateMeasuredPlan, useDeleteMeasuredPlan, useMeasuredPlans } from '../hooks';
import type { MeasuredPlan, Project } from '../types';

type PlansPageProps = {
  project: Project;
};

export function PlansPage({ project }: PlansPageProps) {
  const { data: plans, isLoading } = useMeasuredPlans(project.id);
  const createPlan = useCreateMeasuredPlan(project.id);
  const deletePlan = useDeleteMeasuredPlan(project.id);

  async function handleDelete(plan: MeasuredPlan) {
    const message =
      plan.measurementCount > 0
        ? `Delete "${plan.name}"? ${plan.measurementCount} saved measurement${plan.measurementCount === 1 ? '' : 's'} reference this plan.`
        : `Delete "${plan.name}"?`;

    if (!window.confirm(message)) return;
    await deletePlan.mutateAsync(plan);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 py-2">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">
                Plans
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-neutral-900">
                Architectural plan library
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                Store original plan sheets here before calibration and measurement. Each Measured
                Plan keeps its own scale context so later slices can measure from the correct source
                drawing.
              </p>
            </div>
            <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-500">
              {plans?.length ?? 0} measured plan{(plans?.length ?? 0) === 1 ? '' : 's'}
            </div>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <PlanGridSkeleton />
            ) : plans?.length ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {plans.map((plan) => (
                  <MeasuredPlanCard
                    key={plan.id}
                    plan={plan}
                    projectId={project.id}
                    onDelete={() => void handleDelete(plan)}
                    deleting={deletePlan.isPending && deletePlan.variables?.id === plan.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-6 py-12 text-center">
                <h3 className="font-display text-lg font-semibold text-neutral-800">
                  No plans uploaded yet
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Upload the first architectural image for this project to start building the Plans
                  workspace.
                </p>
              </div>
            )}
          </div>
        </div>

        <PlanUploadPanel creating={createPlan.isPending} onCreatePlan={createPlan.mutateAsync} />
      </section>
    </div>
  );
}
