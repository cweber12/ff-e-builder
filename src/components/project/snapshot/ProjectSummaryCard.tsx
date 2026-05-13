import type { Project } from '../../../types';

export function ProjectSummaryCard({ project }: { project: Project }) {
  const meta = [project.clientName, project.companyName, project.projectLocation].filter(Boolean);

  return (
    <section className="pb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
        Project Snapshot
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        {project.name}
      </h1>
      {meta.length > 0 && <p className="mt-2 text-sm text-neutral-400">{meta.join(' · ')}</p>}
    </section>
  );
}
