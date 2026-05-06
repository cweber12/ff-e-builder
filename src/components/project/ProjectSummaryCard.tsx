import type { ImageAsset, Project } from '../../types';
import { buildProjectSummary } from '../../lib/projectSnapshot';

export function ProjectSummaryCard({
  project,
  projectImages,
}: {
  project: Project;
  projectImages: ImageAsset[];
}) {
  const metrics = buildProjectSummary(project, projectImages);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        Project Snapshot
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-950">{project.name}</h2>
          <p className="mt-1 text-sm text-gray-600">
            High-level project context and quick links into each workspace.
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-md border border-gray-200 bg-surface-muted px-3 py-2.5"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {metric.label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
