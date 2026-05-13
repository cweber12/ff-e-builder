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
    <div className="mx-auto max-w-4xl space-y-10 py-2">
      {/* Project images */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Project Images
          </h2>
        </div>
        <ProjectImagesPanel project={project} />
      </section>

      <div className="border-t border-neutral-200" />

      {/* Project information + Company information */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Project Information
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>

        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Project name" value={project.name} />
          <InfoField label="Client" value={project.clientName || null} />
          <InfoField label="Location" value={project.projectLocation ?? null} />
          <InfoField label="Company" value={project.companyName ?? null} />
          <InfoField
            label="Budget"
            value={project.budgetCents > 0 ? formatMoney(cents(project.budgetCents)) : null}
          />
          <InfoField
            label="Created"
            value={new Date(project.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        </div>
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

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">
        {value ?? <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}
