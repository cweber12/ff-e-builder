import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DeleteProjectModal } from '../components/project/modals/DeleteProjectModal';
import { EditProjectModal } from '../components/project/modals/EditProjectModal';
import { NewProjectModal } from '../components/project/modals/NewProjectModal';
import { ProjectImagesModal } from '../components/project/modals/ProjectImagesModal';
import { ProjectOptionsMenu } from '../components/project/ProjectOptionsMenu';
import { ImageFrame } from '../components/shared/image/ImageFrame';
import { useProjects, useUpdateProject, useDeleteProject, useUserProfile } from '../hooks';
import type { Project } from '../types';

export function DashboardPage() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [imageProject, setImageProject] = useState<Project | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [sort, setSort] = useState<'updated' | 'name' | 'company'>('updated');
  const { data: projects, isLoading } = useProjects();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: userProfile } = useUserProfile();
  const firstName = userProfile?.name?.trim().split(' ')[0];

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'company') {
        const co = (a.companyName ?? '').localeCompare(b.companyName ?? '');
        return co !== 0 ? co : a.name.localeCompare(b.name);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, sort]);

  const companies = Array.from(
    new Set((projects ?? []).map((p) => p.companyName?.trim()).filter(Boolean)),
  );

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
              Dashboard
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold text-neutral-900">
              {firstName ? `Welcome back, ${firstName}` : 'Welcome'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <PlusIcon />
            New Project
          </button>
        </header>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Companies
          </h2>
          {companies.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {companies.map((companyName) => {
                const count = (projects ?? []).filter(
                  (p) => p.companyName?.trim() === companyName,
                ).length;
                return (
                  <span
                    key={companyName}
                    className="inline-flex items-center gap-2 rounded-pill border border-neutral-200 bg-surface px-3 py-1.5 text-sm text-neutral-700"
                  >
                    {companyName}
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">
              Company groupings appear here once projects have a company name assigned.
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Projects
              {projects?.length ? (
                <span className="ml-2 font-normal normal-case tracking-normal text-neutral-300">
                  {projects.length}
                </span>
              ) : null}
            </h2>
            {(projects?.length ?? 0) > 1 && (
              <div className="flex items-center gap-0.5">
                {(['updated', 'name', 'company'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSort(option)}
                    className={[
                      'rounded px-2 py-1 text-xs transition',
                      sort === option
                        ? 'bg-neutral-100 font-medium text-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-600',
                    ].join(' ')}
                  >
                    {option === 'updated' ? 'Recent' : option === 'name' ? 'Name' : 'Company'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <ProjectListSkeleton />
          ) : !projects?.length ? (
            <NoProjectsEmptyState onCreate={() => setNewProjectOpen(true)} />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-surface shadow-sm">
              {sortedProjects.map((project, index) => (
                <article
                  key={project.id}
                  className={[
                    'project-row flex items-center gap-4 px-4 py-3',
                    index > 0 ? 'border-t border-neutral-100' : 'rounded-t-xl',
                    index === sortedProjects.length - 1 ? 'rounded-b-xl' : '',
                    openProjectMenuId === project.id ? 'bg-neutral-50' : 'hover:bg-neutral-50',
                  ].join(' ')}
                >
                  <div
                    className="flex-shrink-0 overflow-hidden rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <ImageFrame
                      entityType="project"
                      entityId={project.id}
                      alt={project.name}
                      className="h-16 w-24 object-cover"
                    />
                  </div>

                  <Link
                    to={`/projects/${project.id}/snapshot`}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                    aria-label={`Open ${project.name} snapshot`}
                  >
                    <div className="min-w-0 flex-1">
                      {project.clientName && (
                        <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
                          {project.clientName}
                        </p>
                      )}
                      <h3 className="font-display mt-0.5 truncate text-lg font-semibold leading-snug text-neutral-900">
                        {project.name}
                      </h3>
                      <p className="mt-0.5 truncate text-sm text-neutral-400">
                        {[
                          project.companyName,
                          project.projectLocation,
                          `Updated ${formatRelativeDate(project.updatedAt)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>

                  <div
                    className="flex flex-shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <ProjectOptionsMenu
                      projectId={project.id}
                      projectName={project.name}
                      open={openProjectMenuId === project.id}
                      onToggle={() =>
                        setOpenProjectMenuId((cur) => (cur === project.id ? null : project.id))
                      }
                      onEdit={() => {
                        setOpenProjectMenuId(null);
                        setEditProject(project);
                      }}
                      onImages={() => {
                        setOpenProjectMenuId(null);
                        setImageProject(project);
                      }}
                      onDelete={() => {
                        setOpenProjectMenuId(null);
                        setPendingDelete(project);
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
      <EditProjectModal
        project={editProject}
        open={editProject !== null}
        isSaving={updateProject.isPending}
        onClose={() => setEditProject(null)}
        onSave={async (projectId, patch) => {
          await updateProject.mutateAsync({ id: projectId, patch });
          setEditProject(null);
        }}
      />
      <DeleteProjectModal
        project={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={(id) => deleteProject.mutate(id)}
      />
      <ProjectImagesModal
        project={imageProject}
        open={imageProject !== null}
        onClose={() => setImageProject(null)}
      />
    </main>
  );
}

function formatRelativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProjectListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-surface shadow-sm">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={[
            'flex items-center gap-4 px-4 py-3',
            i > 0 ? 'border-t border-neutral-100' : '',
          ].join(' ')}
        >
          <div className="h-16 w-24 flex-shrink-0 animate-pulse rounded-lg bg-neutral-100" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-20 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-48 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-14 animate-pulse rounded-md bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-surface px-6 py-12 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <svg aria-hidden="true" viewBox="0 0 220 160" className="h-28 w-40 opacity-60">
          <rect x="38" y="36" width="132" height="92" rx="8" fill="#ECF3F9" />
          <path d="M62 62h84M62 82h64M62 102h76" stroke="#4B7FAB" strokeWidth="6" />
          <circle cx="164" cy="46" r="24" fill="#4B7FAB" opacity="0.12" />
          <path d="M154 46h20M164 36v20" stroke="#4B7FAB" strokeWidth="6" />
        </svg>
        <div>
          <h2 className="font-display text-xl font-semibold text-neutral-800">No projects yet</h2>
          <p className="mt-1.5 text-sm text-neutral-400">
            Create your first project to start building FF&amp;E and proposal deliverables.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <PlusIcon />
          Create your first project
        </button>
      </div>
    </div>
  );
}
