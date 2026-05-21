import { useState } from 'react';
import { useUpdateProject } from '../hooks';
import { formatMoney, cents } from '../types';
import type { Project } from '../types';
import { Button } from '../components/primitives';
import { EditProjectModal } from '../components/project/modals/EditProjectModal';
import { ProjectImagesPanel } from '../components/project/modals/ProjectImagesModal';

type ProjectOverviewPageProps = {
  project: Project;
};

export function ProjectOverviewPage({ project }: ProjectOverviewPageProps) {
  const [editOpen, setEditOpen] = useState(false);
  const updateProject = useUpdateProject();

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-4">
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="eyebrow">Project Images</h2>
        </div>
        <ProjectImagesPanel project={project} />
      </section>

      <section className="section-rule">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="eyebrow">Project Information</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>

        <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Project name" value={project.name} />
          <InfoField label="Client" value={project.clientName || null} />
          <InfoField label="Location" value={project.projectLocation ?? null} />
          <InfoField label="Company" value={project.companyName ?? null} />
          <InfoField
            label="Budget"
            value={project.budgetCents > 0 ? formatMoney(cents(project.budgetCents)) : null}
            numeric
          />
          <InfoField
            label="Created"
            value={new Date(project.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            numeric
          />
        </dl>
      </section>

      <EditProjectModal
        project={project}
        open={editOpen}
        isSaving={updateProject.isPending}
        onClose={() => setEditOpen(false)}
        onSave={async (projectId, patch) => {
          await updateProject.mutateAsync({ id: projectId, patch });
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function InfoField({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string | null | undefined;
  numeric?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-l border-black/10 pl-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </dt>
      <dd className={['text-sm font-medium text-neutral-950', numeric ? 'num' : ''].join(' ')}>
        {value ?? <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}
